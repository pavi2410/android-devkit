import { randomBytes } from "node:crypto";
export const getNonce = () => randomBytes(16).toString("hex");
