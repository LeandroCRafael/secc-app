export interface IntakeActionState {
  status: "idle" | "success" | "error";
  message: string;
}

export const initialIntakeActionState: IntakeActionState = { status: "idle", message: "" };
