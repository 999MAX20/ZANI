import { Navigate } from "react-router-dom";

import { DubaiRealEstatePage } from "./DubaiRealEstatePage";
import ZaniExperience from "./ZaniExperience";

export function PublicHomePage() {
  return <ZaniExperience />;
}

export function PublicCrmPage() {
  return <Navigate to="/#agent" replace />;
}

export function PublicBotsPage() {
  return <Navigate to="/#agent" replace />;
}

export function PublicPricingPage() {
  return <Navigate to="/#proof" replace />;
}

export function PublicContactsPage() {
  return <Navigate to="/#cta" replace />;
}

export function PublicDubaiRealEstatePage() {
  return <DubaiRealEstatePage />;
}
