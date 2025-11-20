"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Link from "next/link";

type Sample = {
  id: string;
  manufacturer: string;
  style_name: string;
  color_name: string;
  checked_out_by: string | null;
  checked_out_at: string | null;
  customers: {
    id: string;
    first_name: string;
    last_name: string;
  };
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

  const [viewBy, setViewBy] = useState<"customer" | "sample">("customer");
  const [sortBy, setSortBy] = useState<"manufacturer" | "style_name" | "color_name">("manufacturer");
  const [samplesList, setSamplesList] = useState<Sample[]>([]);

useEffect(() => {
  fetchData();

  const channel = supabase
    .channel("samples-realtime")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "samples" },
      () => fetchData()
    )
    .subscribe();

  // ✅ synchronous cleanup
  return () => {
    supabase.removeChannel(channel);
  };
}, [viewBy, sortBy]);


  const fetchData = async () => {
    const { data, error } = await supabase
      .from("samples")
      .select("*, customers(*)")
      .eq("status", "checked_out");

    if (error) return console.error(error);

    if (viewBy === "customer") {
      const grouped: Record<string, CustomerGroup> = {};

      data.forEach((s: Sample) => {
        const c = s.customers;
        if (!grouped[c.id]) {
          grouped[c.id] = {
            customer_id: c.id,
            first_name: c.first_name,
            last_name: c.last_name,
            samples: []
          };
        }
        grouped[c.id].samples.push(s);
      });

      const sortedGroups = Object.values(grouped).sort((a, b) =>
        a.last_name.localeCompare(b.last_name)
      );
      setGroups(sortedGroups);
    } else {
      const sortedSamples = [...data].sort((a, b) =>
        (a[sortBy] || "").localeCompare(b[sortBy] || "")
      );
      setSamplesList(sortedSamples);
    }
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

    fetchData();
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

    fetchData();
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Check In Samples</h1>

      <Link href="/checkout" className="text-blue-600 underline mb-4 inline-block">
        Go to Check Out Page
      </Link>

      {/* View toggle and sort */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <button
            className={`px-3 py-1 rounded ${viewBy === "customer" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
            onClick={() => setViewBy("customer")}
          >
            By Customer
          </button>
          <button
            className={`px-3 py-1 rounded ml-2 ${viewBy === "sample" ? "bg-blue-600 text-white" : "bg-gray-200"}`}
            onClick={() => setViewBy("sample")}
          >
            By Sample
          </button>
        </div>

        {viewBy === "sample" && (
          <select
            className="border p-1 rounded"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="manufacturer">Manufacturer</option>
            <option value="style_name">Style Name</option>
            <option value="color_name">Color</option>
          </select>
        )}
      </div>

      {viewBy === "customer" ? (
        groups.length === 0 ? (
          <p>No samples are currently checked out.</p>
        ) : (
          groups.map((group) => (
            <div key={group.customer_id} className="border rounded p-3">
              <button
                onClick={() =>
                  setOpenCustomer((prev) => prev === group.customer_id ? null : group.customer_id)
                }
                className="w-full text-left font-bold text-lg"
              >
                {group.last_name}, {group.first_name}
              </button>

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
                    onClick={() => checkInAll(group.customer_id, group.samples.map((s) => s.id))}
                    className="bg-blue-700 text-white w-full py-2 rounded mt-4"
                  >
                    Check In ALL Samples
                  </button>
                </div>
              )}
            </div>
          ))
        )
      ) : (
        samplesList.length === 0 ? (
          <p>No samples are currently checked out.</p>
        ) : (
          samplesList.map((s) => (
            <div key={s.id} className="border p-3 rounded mb-2">
              <p><strong>Customer:</strong> {s.customers.first_name} {s.customers.last_name}</p>
              <p><strong>Manufacturer:</strong> {s.manufacturer}</p>
              <p><strong>Style:</strong> {s.style_name}</p>
              <p><strong>Color:</strong> {s.color_name}</p>
              <p><strong>Checked Out By:</strong> {s.checked_out_by}</p>
              <button
                onClick={() => checkInSample(s.id)}
                className="bg-green-600 text-white px-4 py-2 rounded mt-2"
              >
                Check In Sample
              </button>
            </div>
          ))
        )
      )}
    </div>
  );
}
