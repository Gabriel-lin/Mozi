import { DataError, ErrorCode } from "../errors";
import { Logger } from "../logger";
import type { DataRecord, PipelineStage, TransformFn } from "./types";

export class DataPipeline<T extends DataRecord = DataRecord> {
  private stages: PipelineStage[] = [];
  private logger: Logger;

  constructor(name?: string) {
    this.logger = new Logger({ module: `data:pipeline${name ? `:${name}` : ""}` });
  }

  pipe<Out extends DataRecord = DataRecord>(
    name: string,
    transform: TransformFn<T, Out>,
  ): DataPipeline<Out> {
    this.stages.push({ name, transform: transform as unknown as TransformFn });
    return this as unknown as DataPipeline<Out>;
  }

  async execute(input: T[]): Promise<DataRecord[]> {
    let data: DataRecord[] = input;

    for (const stage of this.stages) {
      try {
        this.logger.debug(`执行阶段: ${stage.name}`, { inputCount: data.length });
        data = await stage.transform(data);
        this.logger.debug(`阶段完成: ${stage.name}`, { outputCount: data.length });
      } catch (error) {
        throw new DataError(`管道阶段 "${stage.name}" 失败: ${(error as Error).message}`, {
          code: ErrorCode.DATA_TRANSFORM,
          cause: error as Error,
          metadata: { stage: stage.name },
        });
      }
    }

    return data;
  }

  getStages(): string[] {
    return this.stages.map((s) => s.name);
  }

  clear(): void {
    this.stages = [];
  }
}
