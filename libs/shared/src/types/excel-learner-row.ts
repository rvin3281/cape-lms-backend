export type LearnerRow = {
  rowNumber: number;
  username: string;
  email: string;
  firstname: string;
  lastname: string;
  organization: string;
};

export type LearnerRowError = {
  item?: number;
  errors?: string[];
};
