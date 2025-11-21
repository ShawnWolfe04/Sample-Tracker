"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

// -----------------------------
// Types
// -----------------------------
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

// -----------------------------
// Component
// -----------------------------
export default function CheckInPage() {
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [openCustomer, setOpenCustomer] = useState<string | null>(null);

  const [viewBy, setViewBy] = useState<"customer" | "sample">("customer");
  const [sortBy, setSortBy] = useState<
    "manufacturer" | "style_name" | "color_name"
  >("manufacturer");

  const [samplesList, setSamplesList] = useState<Sample[]>([]);

  // -----------------------------
  // fetchData wrapped in useCallback (ESLint safe)
  // -----------------------------
  const fetchData = useCallback(async () => {
    const { data, error } = await supabase
      .from("samples")
      .select("*, customers(*)")
      .eq("status", "checked_out");

    if (error) {
      console.error("Supabase fetch error:", error);
      return;
    }
    if (!data) return;

    // -------- CUSTOMER VIEW --------
    if (viewBy === "customer") {
      const grouped: Record<string, CustomerGroup> = {};

      data.forEach((sample: Sample) => {
        const customer = sample.customers;
        if (!customer) return;

        if (!grouped[customer.id]) {
          grouped[customer.id] = {
            customer_id: customer.id,
            first_name: customer.first_name,
            last_name: customer.last_name,
            samples: [],
          };
        }

        grouped[customer.id].samples.push(sample);
      });

      const sortedGroups = Object.values(grouped).sort((a, b) =>
        a.last_name.localeCompare(b.last_name)
      );

      setGroups(sortedGroups);
      return;
    }

    // -------- SAMPLE VIEW --------
    const sortedSamples = [...data].sort((a, b) =>
      (a[sortBy] || "").localeCompare(b[sortBy] || "")
    );

    setSamplesList(sortedSamples);
  }, [viewBy, sortBy]);

  // -----------------------------
  // useEffect — Initial Load + Realtime
  // -----------------------------
  useEffect(() => {
    (async () => {
      await fetchData();
    })();

    const channel = supabase
      .channel("samples-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "samples" },
        () => fetchData()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // -----------------------------
  // Check-in 1 sample
  // -----------------------------
  const checkInSample = async (id: string) => {
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

    if (error) return alert(error.message);

    fetchData();
  };

  // -----------------------------
  // Check-in all samples for a customer
  // -----------------------------
  const checkInAll = async (customerId: string, sampleIds: string[]) => {
    const name = prompt("Who is checking these in?");
    if (!name) return;

    const { error } = await supabase
      .from("samples")
      .update({
        status: "checked_in",
        checked_in_by: name,
        checked_in_at: new Date().toISOString(),
      })
      .in("id", sampleIds);

    if (error) return alert(error.message);

    fetchData();
  };

  // -----------------------------
  // Render
  // -----------------------------
  return (
    <div className="p-4 space-y-6">
      <h1 className="text-2xl font-bold">Check In Samples</h1>

      <Link href="/checkout" className="text-blue-600 underline">
        Go to Check Out Page
      </Link>

      {/* View Mode + Sort */}
      <div className="flex justify-between items-center mt-4">
        <div className="space-x-2">
          <button
            onClick={() => setViewBy("customer")}
            className={`px-3 py-1 rounded ${
              viewBy === "customer" ? "bg-blue-600 text-white" : "bg-gray-200"
            }`}
          >
            By Customer
          </button>

          <button
            onClick={() => setViewBy("sample")}
            className={`px-3 py-1 rounded ${
              viewBy === "sample" ? "bg-blue-600 text-white" : "bg-gray-200"
            }`}
          >
            By Sample
          </button>
        </div>

        {viewBy === "sample" && (
          <select
            className="border p-1 rounded"
            value={sortBy}
            onChange={(e) =>
              setSortBy(
                e.target.value as
                  | "manufacturer"
                  | "style_name"
                  | "color_name"
              )
            }
          >
            <option value="manufacturer">Manufacturer</option>
            <option value="style_name">Style Name</option>
            <option value="color_name">Color</option>
          </select>
        )}
      </div>

      {/* ------------------ CUSTOMER VIEW ------------------ */}
      {viewBy === "customer" &&
        (groups.length === 0 ? (
          <p>No samples are currently checked out.</p>
        ) : (
          groups.map((group) => (
            <div key={group.customer_id} className="border rounded p-3">
              <button
                onClick={() =>
                  setOpenCustomer(
                    (prev) => (prev === group.customer_id ? null : group.customer_id)
                  )
                }
                className="w-full text-left font-bold text-lg"
              >
                {group.last_name}, {group.first_name}
              </button>

              {openCustomer === group.customer_id && (
                <div className="mt-3 space-y-3">
                  {group.samples.map((sample) => (
                    <div key={sample.id} className="border p-3 rounded">
                      <p>
                        <strong>Manufacturer:</strong> {sample.manufacturer}
                      </p>
                      <p>
                        <strong>Style:</strong> {sample.style_name}
                      </p>
                      <p>
                        <strong>Color:</strong> {sample.color_name}
                      </p>
                      <p>
                        <strong>Checked Out By:</strong> {sample.checked_out_by}
                      </p>
                      <p>
                        <strong>Checked Out At:</strong>{" "}
                        {new Date(sample.checked_out_at || "").toLocaleString()}
                      </p>

                      <button
                        onClick={() => checkInSample(sample.id)}
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
          ))
        ))}

      {/* ------------------ SAMPLE VIEW ------------------ */}
      {viewBy === "sample" &&
        (samplesList.length === 0 ? (
          <p>No samples are currently checked out.</p>
        ) : (
          samplesList.map((sample) => (
            <div key={sample.id} className="border p-3 rounded mb-3">
              <p>
                <strong>Customer:</strong> {sample.customers.first_name}{" "}
                {sample.customers.last_name}
              </p>
              <p>
                <strong>Manufacturer:</strong> {sample.manufacturer}
              </p>
              <p>
                <strong>Style:</strong> {sample.style_name}
              </p>
              <p>
                <strong>Color:</strong> {sample.color_name}
              </p>

              <button
                onClick={() => checkInSample(sample.id)}
                className="bg-green-600 text-white px-4 py-2 rounded mt-2"
              >
                Check In Sample
              </button>
            </div>
          ))
        ))}
    </div>
  );
}
