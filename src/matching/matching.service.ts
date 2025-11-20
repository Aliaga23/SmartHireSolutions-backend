import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { RecomendacionesService } from './recomendaciones.service';

@Injectable()
export class MatchingService {
  constructor(
    private prisma: PrismaService,
    private httpService: HttpService,
    private recomendacionesService: RecomendacionesService,
  ) {}

  async getMatchingData(vacanteId: string) {
    // Obtener vacante con sus requisitos
    const vacante = await this.prisma.vacante.findUnique({
      where: { id: vacanteId },
      include: {
        habilidadesVacante: {
          include: {
            habilidad: true,
          },
        },
        lenguajesVacante: {
          include: {
            lenguaje: true,
          },
        },
      },
    });

    if (!vacante) {
      throw new Error('Vacante no encontrada');
    }

    // Obtener todos los candidatos que se postularon a esta vacante
    const postulaciones = await this.prisma.postulacion.findMany({
      where: { vacanteId },
      include: {
        candidato: {
          include: {
            habilidadesCandidato: {
              include: {
                habilidad: true,
              },
            },
            lenguajesCandidato: {
              include: {
                lenguaje: true,
              },
            },
            experiencias: true,
          },
        },
      },
    });

    // Formatear datos para el microservicio
    const vacanteData = {
      id: vacante.id,
      habilidades: vacante.habilidadesVacante.map((hv) => ({
        nombre: hv.habilidad.nombre,
        nivel: hv.nivel,
        requerido: hv.requerido,
      })),
      idiomas: vacante.lenguajesVacante.map((lv) => ({
        nombre: lv.lenguaje.nombre,
        nivel: lv.nivel,
      })),
    };

    const candidatosData = postulaciones.map((post) => {
      const candidato = post.candidato;

      // Calcular experiencia total en meses
      const experienciaTotalMeses = candidato.experiencias.reduce((total, exp) => {
        if (!exp.fecha_comienzo) return total;
        
        const inicio = new Date(exp.fecha_comienzo);
        const fin = exp.fecha_final ? new Date(exp.fecha_final) : new Date();
        const meses = (fin.getFullYear() - inicio.getFullYear()) * 12 + (fin.getMonth() - inicio.getMonth());
        
        return total + meses;
      }, 0);

      return {
        id: candidato.id,
        habilidades: candidato.habilidadesCandidato.map((hc) => ({
          nombre: hc.habilidad.nombre,
          nivel: hc.nivel,
        })),
        idiomas: candidato.lenguajesCandidato.map((lc) => ({
          nombre: lc.lenguaje.nombre,
          nivel: lc.nivel,
        })),
        experiencia_total_meses: experienciaTotalMeses,
      };
    });

    return {
      vacante: vacanteData,
      candidatos: candidatosData,
    };
  }

  async processMatchingWithKMeans(vacanteId: string) {
    try {
      // 1. Obtener datos usando el método existente
      const matchingData = await this.getMatchingData(vacanteId);

      // 2. Enviar datos al microservicio k-means
      const kmeansUrl = 'https://smar-hire-ml-production.up.railway.app/api/matching';
      const response = await firstValueFrom(
        this.httpService.post(kmeansUrl, matchingData)
      );

      const kmeansResults = response.data as any;
      
      // 3. Actualizar puntuaciones en las postulaciones
      const updatePromises = kmeansResults.candidatos_rankeados.map(async (candidato: any) => {
        return this.prisma.postulacion.updateMany({
          where: {
            vacanteId: vacanteId,
            candidatoId: candidato.candidatoId,
          },
          data: {
            puntuacion_compatibilidad: candidato.score_compatibilidad,
          },
        });
      });

      await Promise.all(updatePromises);

      // 4. Poblar tabla HabilidadesDiferencia con los gaps de habilidades
      await this.processHabilidadesDiferencia(vacanteId, kmeansResults);

      // 5. Generar recomendaciones de forma ASÍNCRONA (no bloquea la respuesta)
      this.generarRecomendacionesParaCandidatos(vacanteId, kmeansResults);

      return {
        message: 'Matching procesado exitosamente',
        candidatos_procesados: kmeansResults.candidatos_rankeados.length,
        habilidades_diferencias_procesadas: true,
        recomendaciones_en_proceso: true,
        resultados: kmeansResults.candidatos_rankeados.map((c: any) => ({
          candidatoId: c.candidatoId,
          score_compatibilidad: c.score_compatibilidad,
          gaps_habilidades: c.habilidades_diferencias?.length || 0,
        })),
      };
    } catch (error) {
      console.error('Error procesando matching:', error);
      throw new HttpException(
        'Error al procesar matching con k-means',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async processHabilidadesDiferencia(vacanteId: string, kmeansResults: any) {
    try {
      // 1. Limpiar datos anteriores en orden correcto (por las foreign keys)
      
      // Primero: Obtener todas las recomendaciones de esta vacante
      const recomendaciones = await this.prisma.recomendacion.findMany({
        where: { vacanteId },
        select: { id: true },
      });

      const recomendacionIds = recomendaciones.map(r => r.id);

      // Segundo: Borrar RecomendacionCurso (depende de Recomendacion)
      if (recomendacionIds.length > 0) {
        await this.prisma.recomendacionCurso.deleteMany({
          where: { recomendacionId: { in: recomendacionIds } },
        });
      }

      // Tercero: Borrar Recomendacion (depende de HabilidadesDiferencia)
      await this.prisma.recomendacion.deleteMany({
        where: { vacanteId },
      });

      // Cuarto: Ahora sí podemos borrar HabilidadesDiferencia
      const deletePromise = this.prisma.habilidadesDiferencia.deleteMany({
        where: { vacanteId },
      });

      // 2. Obtener TODAS las habilidades de una vez
      const todasHabilidadesNombres = new Set<string>();
      kmeansResults.candidatos_rankeados.forEach((candidato: any) => {
        candidato.habilidades_diferencias?.forEach((hab: any) => {
          todasHabilidadesNombres.add(hab.nombre);
        });
      });

      const habilidadesPromise = this.prisma.habilidades.findMany({
        where: { nombre: { in: Array.from(todasHabilidadesNombres) } },
        select: { id: true, nombre: true },
      });

      const [_, habilidades] = await Promise.all([deletePromise, habilidadesPromise]);

      const habilidadMap = new Map(habilidades.map(h => [h.nombre, h.id]));

      const registrosParaInsertar: Array<{
        candidatoId: string;
        vacanteId: string;
        habilidadId: string;
        diferencia: number;
      }> = [];

      kmeansResults.candidatos_rankeados.forEach((candidato: any) => {
        candidato.habilidades_diferencias?.forEach((habilidadDiff: any) => {
          const habilidadId = habilidadMap.get(habilidadDiff.nombre);
          if (habilidadId) {
            registrosParaInsertar.push({
              candidatoId: candidato.candidatoId,
              vacanteId: vacanteId,
              habilidadId: habilidadId,
              diferencia: habilidadDiff.diferencia,
            });
          }
        });
      });

      // 5. Inserción masiva en una sola operación
      if (registrosParaInsertar.length > 0) {
        await this.prisma.habilidadesDiferencia.createMany({
          data: registrosParaInsertar,
          skipDuplicates: true,
        });
      }

      console.log(`Procesadas ${registrosParaInsertar.length} diferencias de habilidades para vacante ${vacanteId}`);
    } catch (error) {
      console.error('Error procesando HabilidadesDiferencia:', error);
      throw error;
    }
  }

  private generarRecomendacionesParaCandidatos(vacanteId: string, kmeansResults: any) {
    // Disparar generación de recomendaciones de forma asíncrona para cada candidato
    kmeansResults.candidatos_rankeados.forEach((candidato: any) => {
      const tieneGaps = candidato.habilidades_diferencias?.some(
        (hab: any) => hab.diferencia < 0
      );
      
      if (tieneGaps) {
        this.recomendacionesService.generarRecomendacionesAsync(
          vacanteId,
          candidato.candidatoId
        );
      }
    });

    console.log(`Recomendaciones iniciadas en background para vacante ${vacanteId}`);
  }
}
