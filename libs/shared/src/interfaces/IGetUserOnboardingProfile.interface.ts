export interface IGetUserOnBoardingProfile {
  userId: string;
  learnworldId: string;
  email: string;
  firstName: string;
  lastName: string;
  userName: string;
  profile: {
    organization: string;
    phoneNumber: string;
    jobTitle: string;
    currentRole: string;
    targetRole: string;
    industry: string;
    careerGoals: string;
    skills: string[];
  };
}
