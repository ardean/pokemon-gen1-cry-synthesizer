export interface Command {
  note?: number[];
  duty?: number;
}

export default interface CryType {
  name?: string;
  pulse1: Command[];
  pulse2: Command[];
  noise: Command[];
}