import { db } from "../db";
import { StepUpRequirement } from "../../types";

export const stepUpRequirementService = {
  async getStepUpRequirements(): Promise<StepUpRequirement[]> {
    return (await db.stepUpRequirements.toArray()).sort(
      (left, right) => right.updatedAt - left.updatedAt,
    );
  },

  async getStepUpRequirementsForTask(taskId: string): Promise<StepUpRequirement[]> {
    return (
      await db.stepUpRequirements.where("taskId").equals(taskId).toArray()
    ).sort((left, right) => right.updatedAt - left.updatedAt);
  },

  async replaceStepUpRequirements(requirements: StepUpRequirement[]): Promise<void> {
    await db.transaction("rw", db.stepUpRequirements, async () => {
      await db.stepUpRequirements.clear();
      if (requirements.length > 0) {
        await db.stepUpRequirements.bulkPut(requirements);
      }
    });
  },

  async upsertStepUpRequirement(
    requirement: StepUpRequirement,
  ): Promise<StepUpRequirement> {
    const record = {
      ...requirement,
      updatedAt: Date.now(),
    };
    await db.stepUpRequirements.put(record);
    return record;
  },
};
