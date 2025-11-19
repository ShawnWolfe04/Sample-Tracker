"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

type Sample = {
  id: string;
  manufacturer: string;
  style_name: string;
  color_name: string;
  checked_out_by: string | null;
  checked_out_at: string | null;
};

type CustomerGroup = {
  customer_id: string;
  first_name: string;
  last_name: string;
  samples: Sample[];
};

export default function CheckInPage() {
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [openCustomer, setOpenCustomer] = useState<string | null>(null);

useEffect(() => {
  fetchGroups();

  const channel = supabase
    .channel("samples-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "samples" },
      () => fetchGroups()
    )
    .subscribe();

  return () => {
    // React cleanup must NOT be async
    supabase.removeChannel(channel);
  };
}, []);


  const fetchGroups = async () => {
    const { data, error } = await supabase
      .from("samples")
      .select("*, customers(*)")
      .eq("status", "checked_out");

    if (error) return console.error(error);

    const grouped: Record<string, CustomerGroup> = {};

    data.forEach((s: any) => {
      const c = s.customers;

      if (!grouped[c.id]) {
        grouped[c.id] = {
          customer_id: c.id,
          first_name: c.first_name,
          last_name: c.last_name,
          samples: []
        };
      }

      grouped[c.id].samples.push({
        id: s.id,
        manufacturer: s.manufacturer,
        style_name: s.style_name,
        color_name: s.color_name,
        checked_out_by: s.checked_out_by,
        checked_out_at: s.checked_out_at
      });
    });

    const sorted = Object.values(grouped).sort((a, b) =>
      a.last_name.localeCompare(b.last_name)
    );

    setGroups(sorted);
  };

  const checkInSample = async (id: string) => {
    const name = prompt("Who is checking this in?");
    if (!name) return;

    await supabase
      .from("samples")
      .update({
        status: "checked_in",
        checked_in_by: name,
        checked_in_at: new Date().toISOString()
      })
      .eq("id", id);

    fetchGroups();
  };

  const checkInAll = async (customerId: string, sampleIds: string[]) => {
    const name = prompt("Who is checking these in?");
    if (!name) return;

    await supabase
      .from("samples")
      .update({
        status: "checked_in",
        checked_in_by: name,
        checked_in_at: new Date().toISOString()
      })
      .in("id", sampleIds);

    fetchGroups();
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Check In Samples</h1>

      {groups.length === 0 && <p>No samples are currently checked out.</p>}

      {groups.map((group) => (
        <div key={group.customer_id} className="border rounded p-3">
          {/* Customer Header */}
          <button
            onClick={() =>
              setOpenCustomer((prev) =>
                prev === group.customer_id ? null : group.customer_id
              )
            }
            className="w-full text-left font-bold text-lg"
          >
            {group.last_name}, {group.first_name}
          </button>

          {/* Expandable sample list */}
          {openCustomer === group.customer_id && (
            <div className="mt-3 space-y-3">
              {group.samples.map((s) => (
                <div key={s.id} className="border p-3 rounded">
                  <p><strong>Manufacturer:</strong> {s.manufacturer}</p>
                  <p><strong>Style:</strong> {s.style_name}</p>
                  <p><strong>Color:</strong> {s.color_name}</p>
                  <p><strong>Checked Out By:</strong> {s.checked_out_by}</p>
                  <p>
                    <strong>Checked Out At:</strong>{" "}
                    {new Date(s.checked_out_at || "").toLocaleString()}
                  </p>

                  <button
                    onClick={() => checkInSample(s.id)}
                    className="bg-green-600 text-white px-4 py-2 rounded mt-2"
                  >
                    Check In Sample
                  </button>
                </div>
              ))}

              <button
                onClick={() =>
                  checkInAll(
                    group.customer_id,
                    group.samples.map((s) => s.id)
                  )
                }
                className="bg-blue-700 text-white w-full py-2 rounded mt-4"
              >
                Check In ALL Samples
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
