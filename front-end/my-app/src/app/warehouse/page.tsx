// src/warehouse/page.tsx
'use client';

import { useState, useEffect } from "react";

interface Tag {
    OrgId: number;
    TagUid: string;
    BatteryVoltageMv: number;
    EventTime: Date;
    LastRssi: number;
    Lat: number;
    Lng: number;
    SourceId: number;
    SourceType: string;
}

export default function WareHousePage() {
    const [tags, setTags] = useState<Tag[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const interval = setInterval(async () =>{
            try{
                const res = await fetch("/api/tag");
                const data = await res.json();
                setTags(data?.Tags || []);
                setLoading(false);
            } catch (err) {
                console.error("Failed to fetch tag:",err);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, []);

   return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Warehouse - ข้อมูล Tags</h1>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table className="min-w-full border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border">Tag UID</th>
              <th className="p-2 border">Battery (mV)</th>
              <th className="p-2 border">RSSI</th>
              <th className="p-2 border">Zone / Source</th>
              <th className="p-2 border">Event Time</th>
              <th className="p-2 border">Location</th>
            </tr>
          </thead>
          <tbody>
            {tags.map((t) => (
              <tr key={t.TagUid} className="text-center border-b">
                <td className="p-2 border">{t.TagUid}</td>
                <td className="p-2 border">{t.BatteryVoltageMv ?? "-"}</td>
                <td className="p-2 border">{t.LastRssi}</td>
                <td className="p-2 border">{t.SourceId}</td>
                <td className="p-2 border">{t.EventTime ? new Date(t.EventTime).toLocaleString() : "-"}</td>
                <td className="p-2 border">
                  {t.Lat && t.Lng ? `${t.Lat.toFixed(5)}, ${t.Lng.toFixed(5)}` : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
