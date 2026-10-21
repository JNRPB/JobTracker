export const HQ_ACCESS_AREAS = [
  {
    id: "home",
    label: "Home",
    description: "Homepage overview, active-job slideshow and HQ notices.",
    component: "WelcomeScreen",
  },
  {
    id: "jobs",
    label: "Jobs",
    description: "Jobs, customers, quotes, invoices and job details.",
    component: "JobStatusOverview",
  },
  {
    id: "schedule",
    label: "Schedule",
    description: "Week planning, people, vehicles, equipment and site attendance.",
    component: "SchedulePage",
  },
  {
    id: "todos",
    label: "TODO",
    description: "The company and job TODO boards.",
    component: "TodoPage",
  },
  {
    id: "spend",
    label: "Spend",
    description: "Spend timeline, purchases and cost analysis.",
    component: "SpendCalendar",
  },
  {
    id: "journeys",
    label: "Journeys",
    description: "Tracking, mileage, visits and journey allocation.",
    component: "JobHeatMap",
  },
  {
    id: "files",
    label: "Files",
    description: "Uploaded documents, receipts and the unsorted inbox.",
    component: "Files",
  },
  {
    id: "vat",
    label: "VAT",
    description: "Input VAT, output VAT and accountant-pack decisions.",
    component: "BusinessFacts",
  },
  {
    id: "activity",
    label: "Activity",
    description: "Job activity and historical spend timeline.",
    component: "ForecastPage",
  },
];

const SCREEN_PERMISSIONS = {
  MyProfile: "profile",
  WelcomeScreen: "home",
  TeamHome: "home",
  JobStatusOverview: "jobs",
  CreateJob: "jobs",
  JobCard: "jobs",
  JobDocuments: "jobs",
  PricingNotesPage: "jobs",
  SchedulePage: "schedule",
  ResourceProfile: "schedule",
  QuoteBuilder: "jobs",
  InvoiceBuilder: "jobs",
  ArchivedJobs: "jobs",
  TodoPage: "todos",
  Transactions: "spend",
  SpendCalendar: "spend",
  JobHeatMap: "journeys",
  Files: "files",
  UnsortedFiles: "files",
  BusinessFacts: "vat",
  ForecastPage: "activity",
  Settings: "settings",
};

export function isAdmin(user) {
  return user?.role === "admin";
}

export function isSiteUser(user) {
  return !isAdmin(user) && user?.homeView === "site";
}

export function canAccessArea(user, permission) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return Array.isArray(user.permissions) && user.permissions.includes(permission);
}

export function canAccessScreen(user, screen) {
  if (!user) return false;
  if (screen === "MyProfile") return true;
  if (isSiteUser(user)) return screen === "TeamHome";
  const permission = SCREEN_PERMISSIONS[screen] || "home";
  if (permission === "settings") return isAdmin(user);
  return canAccessArea(user, permission);
}

export function defaultScreenForUser(user) {
  if (isSiteUser(user)) return "TeamHome";
  if (canAccessArea(user, "home")) return "WelcomeScreen";
  const firstArea = HQ_ACCESS_AREAS.find((area) =>
    canAccessArea(user, area.id),
  );
  return firstArea?.component || "WelcomeScreen";
}
