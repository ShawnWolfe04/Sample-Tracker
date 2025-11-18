"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

// Optional but recommended: define a type
type Sample = {
  id: number;
  name: string;
  status: string;
  checked_out_by: string | null;
  checked_out_at: string | null;
  checked_in_by?: string | null;
  checked_in_at?: string | null;
};

export default function CheckInPage() {
  const [samples, setSamples] = useState<Sample[]>([]);

useEffect(() => {
  fetchSamples(); // initial load

  const channel = supabase
    .channel("samples-changes")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "samples",
      },
      () => {
        fetchSamples(); // refresh list after any database change
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, []);


  const fetchSamples = async () => {
    const { data, error } = await supabase
      .from("samples")
      .select("*")
      .eq("status", "checked_out")
      .order("checked_out_at", { ascending: false });

    if (error) {
      console.error(error);
    } else {
      setSamples(data || []);
    }
  };

  const handleCheckIn = async (id: number) => {
    const name = prompt("Who is checking this in?");
    if (!name) return;

    const { error } = await supabase
      .from("samples")
      .update({
        status: "checked_in",
        checked_in_by: name,
        checked_in_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) alert(error.message);
    else {
  setSamples((prev) => prev.filter((s) => s.id !== id));
  fetchSamples(); // still good as a backup
}

  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold mb-4">Check In Samples</h1>

      {samples.length === 0 && <p>No samples currently checked out.</p>}

      {samples.map((sample) => (
        <div key={sample.id} className="border p-4 rounded space-y-1">
          <p><strong>Name:</strong> {sample.name}</p>
          <p><strong>Checked Out By:</strong> {sample.checked_out_by}</p>
          <p>
            <strong>Checked Out At:</strong>{" "}
            {new Date(sample.checked_out_at || "").toLocaleString()}
          </p>

          <button
            onClick={() => handleCheckIn(sample.id)}
            className="bg-green-600 text-white px-4 py-2 rounded mt-2"
          >
            Check In
          </button>
        </div>
      ))}
    </div>
  );
}
