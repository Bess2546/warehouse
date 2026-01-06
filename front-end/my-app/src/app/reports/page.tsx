"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar,XAxis,YAxis, Legend,LineChart,Line,CartesianGrid } from "recharts";

interface StatsSummary {
    totalTags: number;
    totalIn: number;
    totalOut: number;
    totalWarehouses: number;
}

interface DailyMovement {
    date: number;
    IN: number;
    OUT: number;
}

interface WarehouseStats{
    warehouseName: string;
    tagCount: number;
}

const COLORS = ['#4ade80', '#f87171'];

export default function ReportsPage() {
    const {user, isLoading, isAdmin } = useAuth();
    const router = useRouter();

    const [summary, setSummary] = useState<StatsSummary | null>(null);
    const [dailyData, setDailyData] = useState<DailyMovement[]>([]);
    const [warehouseData, setWarehouseData] = useState<WarehouseStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLastUpdate] = useState(new Date());

}