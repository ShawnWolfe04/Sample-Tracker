"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

type Customer = {
  id: string;
  first_name: string;
  last_name: string;
};

type Sample = {
  id: string;
  manufacturer: string;
  style_name: string;
  color_name: string;
  checked_out_by: string | null;
  checked_out_at: string | null;
  customers: Customer;
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
  const [sortBy, setSortBy] = useState<"manufacturer" | "style_name" | "color_name">(
    "manufacturer"
  );

  const [samplesList, setSamplesList] = useState<Sample[]>([]);
  const [search, setSearch] = useState("");

  // ---------- FETCH DATA ----------
  const fetchData = useCallback(async () => {
    const { data, error } = await supabase
      .from("samples")
      .select("*, customers(*)")
      .eq("status", "checked_out");

    if (error || !data) return;

    if (viewBy === "customer") {
      const grouped: Record<string, CustomerGroup> = {};

      data.forEach((sample: Sample) => {
        const c = sample.customers;
        if (!c) return;

        if (!grouped[c.id]) {
          grouped[c.id] = {
            customer_id: c.id,
            first_name: c.first_name,
            last_name: c.last_name,
            samples: [],
          };
        }

        grouped[c.id].samples.push(sample);
      });

      const sorted = Object.values(grouped).sort((a, b) =>
        a.last_name.localeCompare(b.last_name)
      );

      setGroups(sorted);
    } else {
      setSamplesList(
        [...data].sort((a, b) =>
          (a[sortBy] ?? "").localeCompare(b[sortBy] ?? "")
        )
      );
    }
  }, [viewBy, sortBy]);

  // ---------- REALTIME + INITIAL LOAD ----------
  useEffect(() => {
    // INITIAL LOAD — safe
    Promise.resolve().then(fetchData);

    // SUBSCRIBE
    const channel = supabase
      .channel("samples-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "samples" },
        fetchData
      )
      .subscribe();

    // CLEANUP — MUST BE SYNC
    return () => {
      supabase.removeChannel(channel); // Wrapped in sync function
    };
  }, [fetchData]);

  // ---------- SEARCH ----------
  const query = search.trim().toLowerCase();

  const filteredGroups =
    viewBy === "customer"
      ? groups.filter((g) => {
          if (!query) return true;

          const full = `${g.first_name} ${g.last_name}`.toLowerCase();
          const reversed = `${g.last_name} ${g.first_name}`.toLowerCase();

          const nameMatch = full.includes(query) || reversed.includes(query);

          const sampleMatch = g.samples.some((s) =>
            [s.manufacturer, s.style_name, s.color_name]
              .some((v) => v?.toLowerCase().includes(query))
          );

          return nameMatch || sampleMatch;
        })
      : groups;

  const filteredSamples =
    viewBy === "sample"
      ? samplesList.filter((s) =>
          [
            s.customers.first_name,
            s.customers.last_name,
            s.manufacturer,
            s.style_name,
            s.color_name,
          ].some((v) => v?.toLowerCase().includes(query))
        )
      : samplesList;

  // ---------- CHECK-IN ----------
  const checkInSample = async (id: string) => {
    const name = prompt("Who is checking this in?");
    if (!name) return;

    await supabase
      .from("samples")
      .update({
        status: "checked_in",
        checked_in_by: name,
        checked_in_at: new Date().toISOString(),
      })
      .eq("id", id);

    fetchData();
  };

  const checkInAll = async (customerId: string, sampleIds: string[]) => {
    const name = prompt("Who is checking all samples in?");
    if (!name) return;

    await supabase
      .from("samples")
      .update({
        status: "checked_in",
        checked_in_by: name,
        checked_in_at: new Date().toISOString(),
      })
      .in("id", sampleIds);

    fetchData();
  };

  return (
    <div className="min-h-screen flex justify-center">
      <div className="w-full max-w-2xl p-4 space-y-6">

        <h1 className="text-3xl font-bold text-center">Check In Samples</h1>

        <div className="text-center">
          <Link href="/checkout" className="text-blue-600 underline">
            Go to Check Out Page
          </Link>
        </div>

        {/* Search */}
        <input
          className="border p-2 w-full rounded bg-white text-black shadow-sm"
          placeholder="Search customers, samples, style, color..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* View toggle */}
        <div className="flex justify-between items-center">
          <div className="space-x-2">
            <button
              onClick={() => setViewBy("customer")}
              className={`px-3 py-1 rounded shadow ${
                viewBy === "customer"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-black"
              }`}
            >
              By Customer
            </button>

            <button
              onClick={() => setViewBy("sample")}
              className={`px-3 py-1 rounded shadow ${
                viewBy === "sample"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-black"
              }`}
            >
              By Sample
            </button>
          </div>

          {viewBy === "sample" && (
            <select
              className="border p-2 rounded bg-white text-black shadow-sm"
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value as "manufacturer" | "style_name" | "color_name"
                )
              }
            >
              <option value="manufacturer">Manufacturer</option>
              <option value="style_name">Style Name</option>
              <option value="color_name">Color</option>
            </select>
          )}
        </div>

        {/* CUSTOMER VIEW */}
        {viewBy === "customer" &&
          (filteredGroups.length === 0 ? (
            <p>No samples are checked out.</p>
          ) : (
            filteredGroups.map((group) => (
              <div key={group.customer_id} className="border rounded-lg p-4 bg-white shadow">

                <button
                  onClick={() =>
                    setOpenCustomer(
                      openCustomer === group.customer_id
                        ? null
                        : group.customer_id
                    )
                  }
                  className="w-full text-left text-lg font-semibold"
                >
                  {group.last_name}, {group.first_name}
                </button>

                {openCustomer === group.customer_id && (
                  <div className="mt-4 space-y-4">

                    {group.samples.map((s) => (
                      <div key={s.id} className="border rounded p-3 bg-gray-50">
                        <p><strong>Manufacturer:</strong> {s.manufacturer}</p>
                        <p><strong>Style:</strong> {s.style_name}</p>
                        <p><strong>Color:</strong> {s.color_name}</p>

                        <button
                          onClick={() => checkInSample(s.id)}
                          className="bg-green-600 text-white px-3 py-1 rounded mt-2"
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
                      className="bg-blue-700 text-white py-2 rounded w-full mt-4"
                    >
                      Check In ALL Samples
                    </button>
                  </div>
                )}
              </div>
            ))
          ))}

        {/* SAMPLE VIEW */}
        {viewBy === "sample" &&
          (filteredSamples.length === 0 ? (
            <p>No samples are checked out.</p>
          ) : (
            filteredSamples.map((s) => (
              <div key={s.id} className="border rounded-lg p-4 bg-white shadow space-y-1">
                <p><strong>Customer:</strong> {s.customers.first_name} {s.customers.last_name}</p>
                <p><strong>Manufacturer:</strong> {s.manufacturer}</p>
                <p><strong>Style:</strong> {s.style_name}</p>
                <p><strong>Color:</strong> {s.color_name}</p>

                <button
                  onClick={() => checkInSample(s.id)}
                  className="bg-green-600 text-white px-3 py-1 rounded mt-2"
                >
                  Check In Sample
                </button>
              </div>
            ))
          ))}
      </div>
    </div>
  );
}
