import type { Metadata } from "next";
import Dashboard from "@/features/dashboard/Dashboard";

export const metadata: Metadata = {
  title: "Quản lý shop · SmartSales",
};

export default function DashboardPage() {
  return <Dashboard />;
}
