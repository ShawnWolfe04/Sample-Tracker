"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabaseClient";

// TYPES
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

type Group = {
  customer_id: string;
  first_name: string;
  last_name: string;
  samples: Sample[];
};

export default function CheckInPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  const [viewBy, setViewBy] = useState<"customer" | "sample">("customer");
  const [sortBy, setSortBy] =
    useState<"manufacturer" | "style_name" | "color_name">("manufacturer");

  const [samplesList, setSamplesList] = useState<Sample[]>([]);
  const [search, setSearch] = useState("");

  // FETCH
  const fetchData = useCallback(async () => {
    const { data, error } = await supabase
      .from("samples")
      .select("*, customers(*)")
      .eq("status", "checked_out");

    if (error || !data) return;

    const rows = data as Sample[];

    if (viewBy === "customer") {
      const map: Record<string, Group> = {};

      rows.forEach((s) => {
        const c = s.customers;
        if (!c) return;

        if (!map[c.id]) {
          map[c.id] = {
            customer_id: c.id,
            first_name: c.first_name,
            last_name: c.last_name,
            samples: [],
          };
        }
        map[c.id].samples.push(s);
      });

      const sorted = Object.values(map).sort((a, b) =>
        a.last_name.localeCompare(b.last_name)
      );

      setGroups(sorted);
    } else {
      setSamplesList(
        [...rows].sort((a, b) =>
          (a[sortBy] || "").localeCompare(b[sortBy] || "")
        )
      );
    }
  }, [viewBy, sortBy]);

  // LOAD + REALTIME — FIXED VERSION
  useEffect(() => {
    // run fetch async but without returning Promise
    setTimeout(() => {
      void fetchData();
    }, 0);

    const channel = supabase
      .channel("samples-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "samples" },
        () => void fetchData()
      )
      .subscribe();

    // Cleanup MUST NOT return a Promise → FIX
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // SEARCH
  const q = search.toLowerCase();

  const filteredGroups = groups.filter((g) => {
    if (!q) return true;

    const full = `${g.first_name} ${g.last_name}`.toLowerCase();
    const rev = `${g.last_name} ${g.first_name}`.toLowerCase();

    const matchName = full.includes(q) || rev.includes(q);
    const matchSample = g.samples.some((s) =>
      [s.manufacturer, s.style_name, s.color_name]
        .filter(Boolean)
        .some((f) => f!.toLowerCase().includes(q))
    );

    return matchName || matchSample;
  });

  const filteredSamples =
    viewBy === "sample"
      ? samplesList.filter((s) =>
          [
            s.customers.first_name,
            s.customers.last_name,
            s.manufacturer,
            s.style_name,
            s.color_name,
          ]
            .filter(Boolean)
            .some((f) => f!.toLowerCase().includes(q))
        )
      : samplesList;

  // ACTIONS
  const checkInOne = async (id: string) => {
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

    void fetchData();
  };

  const checkInAll = async (cid: string, ids: string[]) => {
    const name = prompt("Who is checking all samples in?");
    if (!name) return;

    await supabase
      .from("samples")
      .update({
        status: "checked_in",
        checked_in_by: name,
        checked_in_at: new Date().toISOString(),
      })
      .in("id", ids);

    void fetchData();
  };

  // RENDER
  return (
    <div className="flex justify-center min-h-screen px-4">
      <div className="w-full max-w-md space-y-6 py-6">
        <h1 className="text-2xl font-bold text-center">Check In Samples</h1>

        <input
          className="input w-full"
          placeholder="Search customers or samples..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Toggle */}
        <div className="flex justify-between items-center">
          <div className="space-x-2">
            <button
              onClick={() => setViewBy("customer")}
              className={`px-3 py-1 rounded ${
                viewBy === "customer"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-black"
              }`}
            >
              By Customer
            </button>

            <button
              onClick={() => setViewBy("sample")}
              className={`px-3 py-1 rounded ${
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
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value as "manufacturer" | "style_name" | "color_name"
                )
              }
              className="input w-36"
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
            <p className="text-center text-gray-500">No samples are checked out.</p>
          ) : (
            filteredGroups.map((g) => (
              <div key={g.customer_id} className="card">
                <button
                  onClick={() =>
                    setOpen(open === g.customer_id ? null : g.customer_id)
                  }
                  className="w-full text-left font-semibold"
                >
                  {g.last_name}, {g.first_name}
                </button>

                {open === g.customer_id && (
                  <div className="mt-3 space-y-3">
                    {g.samples.map((s) => (
                      <div
                        key={s.id}
                        className="p-3 rounded border bg-gray-50 space-y-1"
                      >
                        <p><b>Manufacturer:</b> {s.manufacturer}</p>
                        <p><b>Style:</b> {s.style_name}</p>
                        <p><b>Color:</b> {s.color_name}</p>
                        <p>
                          <b>Checked Out:</b>{" "}
                          {new Date(s.checked_out_at || "").toLocaleString()}
                        </p>

                        <button
                          onClick={() => checkInOne(s.id)}
                          className="btn-green mt-2"
                        >
                          Check In
                        </button>
                      </div>
                    ))}

                    <button
                      onClick={() =>
                        checkInAll(
                          g.customer_id,
                          g.samples.map((s) => s.id)
                        )
                      }
                      className="btn-primary w-full"
                    >
                      Check In ALL
                    </button>
                  </div>
                )}
              </div>
            ))
          ))}

        {/* SAMPLE VIEW */}
        {viewBy === "sample" &&
          (filteredSamples.length === 0 ? (
            <p className="text-center text-gray-500">No samples are checked out.</p>
          ) : (
            filteredSamples.map((s) => (
              <div key={s.id} className="card space-y-1">
                <p>
                  <b>Customer:</b> {s.customers.first_name} {s.customers.last_name}
                </p>
                <p><b>Manufacturer:</b> {s.manufacturer}</p>
                <p><b>Style:</b> {s.style_name}</p>
                <p><b>Color:</b> {s.color_name}</p>

                <button
                  onClick={() => checkInOne(s.id)}
                  className="btn-green mt-2"
                >
                  Check In
                </button>
              </div>
            ))
          ))}
      </div>
    </div>
  );
}
