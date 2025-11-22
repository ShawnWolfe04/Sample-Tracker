"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
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

  // EDITING STATE – SAMPLES
  const [editingSampleId, setEditingSampleId] = useState<string | null>(null);
  const [editingSampleValues, setEditingSampleValues] = useState<{
    manufacturer: string;
    style_name: string;
    color_name: string;
  }>({
    manufacturer: "",
    style_name: "",
    color_name: "",
  });

  // EDITING STATE – CUSTOMERS
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [editingCustomerValues, setEditingCustomerValues] = useState<{
    first_name: string;
    last_name: string;
  }>({
    first_name: "",
    last_name: "",
  });

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

  // LOAD + REALTIME
  useEffect(() => {
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

  // ACTIONS – CHECK IN
  const checkInOne = async (id: string) => {
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

    if (error) {
      alert(error.message);
      return;
    }

    void fetchData();
  };

  const checkInAll = async (cid: string, ids: string[]) => {
    const name = prompt("Who is checking all samples in?");
    if (!name) return;

    const { error } = await supabase
      .from("samples")
      .update({
        status: "checked_in",
        checked_in_by: name,
        checked_in_at: new Date().toISOString(),
      })
      .in("id", ids);

    if (error) {
      alert(error.message);
      return;
    }

    void fetchData();
  };

  // ACTIONS – EDIT SAMPLE
  const startEditSample = (sample: Sample) => {
    setEditingSampleId(sample.id);
    setEditingSampleValues({
      manufacturer: sample.manufacturer || "",
      style_name: sample.style_name || "",
      color_name: sample.color_name || "",
    });
  };

  const cancelEditSample = () => {
    setEditingSampleId(null);
  };

  const saveSampleEdit = async (id: string) => {
    const { manufacturer, style_name, color_name } = editingSampleValues;

    const { error } = await supabase
      .from("samples")
      .update({
        manufacturer,
        style_name,
        color_name,
      })
      .eq("id", id);

    if (error) {
      alert(error.message);
      return;
    }

    setEditingSampleId(null);
    void fetchData();
  };

  // ACTIONS – EDIT CUSTOMER
  const startEditCustomer = (g: Group) => {
    setEditingCustomerId(g.customer_id);
    setEditingCustomerValues({
      first_name: g.first_name || "",
      last_name: g.last_name || "",
    });
  };

  const cancelEditCustomer = () => {
    setEditingCustomerId(null);
  };

  const saveCustomerEdit = async (customerId: string) => {
    const { first_name, last_name } = editingCustomerValues;

    const { error } = await supabase
      .from("customers")
      .update({
        first_name,
        last_name,
      })
      .eq("id", customerId);

    if (error) {
      alert(error.message);
      return;
    }

    setEditingCustomerId(null);
    void fetchData();
  };

  // RENDER
  return (
    <div className="min-h-screen flex flex-col items-center px-4 pb-16">
      {/* HEADER: logo + nav (same style as checkout) */}
      <header className="w-full border-b border-neutral-300 dark:border-neutral-800 mb-6">
        <div className="max-w-xl mx-auto flex flex-col items-center gap-3 py-4">
          <Image
            src="https://gainesvillecarpetsplus.com/wp-content/uploads/2021/11/gnsvspls-768x250.webp"
            width={220}
            height={90}
            alt="Logo"
            className="rounded"
          />
          <nav className="flex gap-6 text-lg font-semibold">
            <Link
              href="/checkin"
              className="hover:underline text-gray-900 dark:text-gray-100"
            >
              Check In
            </Link>
            <Link
              href="/checkout"
              className="hover:underline text-gray-900 dark:text-gray-100"
            >
              Check Out
            </Link>
          </nav>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="w-full flex justify-center">
        <div className="w-full max-w-md space-y-6 py-6">
          <h1 className="text-2xl font-bold text-center">Check In Samples</h1>

          {/* SEARCH */}
          <input
            className="input w-full bg-white text-black dark:bg-neutral-900 dark:text-white border border-gray-300 dark:border-neutral-700 rounded px-3 py-2"
            placeholder="Search customers or samples..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* TOGGLE + SORT */}
          <div className="flex justify-between items-center">
            <div className="space-x-2">
              <button
                onClick={() => setViewBy("customer")}
                className={`px-3 py-1 rounded text-sm font-medium border ${
                  viewBy === "customer"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-gray-200 text-gray-800 border-gray-300 dark:bg-neutral-800 dark:text-gray-100 dark:border-neutral-600"
                }`}
              >
                By Customer
              </button>

              <button
                onClick={() => setViewBy("sample")}
                className={`px-3 py-1 rounded text-sm font-medium border ${
                  viewBy === "sample"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-gray-200 text-gray-800 border-gray-300 dark:bg-neutral-800 dark:text-gray-100 dark:border-neutral-600"
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
                    e.target.value as
                      | "manufacturer"
                      | "style_name"
                      | "color_name"
                  )
                }
                className="input w-36 bg-white text-black dark:bg-neutral-900 dark:text-white border border-gray-300 dark:border-neutral-700 rounded px-2 py-1"
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
              <p className="text-center text-gray-500">
                No samples are checked out.
              </p>
            ) : (
              filteredGroups.map((g) => (
                <div
                  key={g.customer_id}
                  className="card bg-white text-black dark:bg-neutral-900 dark:text-white border border-gray-200 dark:border-neutral-700 rounded-lg p-4 space-y-3"
                >
                  {/* Customer header row */}
                  <button
                    onClick={() =>
                      setOpen(open === g.customer_id ? null : g.customer_id)
                    }
                    className="w-full text-left font-semibold text-lg"
                  >
                    {g.last_name}, {g.first_name}
                  </button>

                  {open === g.customer_id && (
                    <div className="mt-2 space-y-4">
                      {/* EDIT CUSTOMER INFO */}
                      {editingCustomerId === g.customer_id ? (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <input
                              className="input flex-1 bg-white text-black dark:bg-neutral-900 dark:text-white border border-gray-300 dark:border-neutral-700 rounded px-2 py-1"
                              placeholder="First name"
                              value={editingCustomerValues.first_name}
                              onChange={(e) =>
                                setEditingCustomerValues((prev) => ({
                                  ...prev,
                                  first_name: e.target.value,
                                }))
                              }
                            />
                            <input
                              className="input flex-1 bg-white text-black dark:bg-neutral-900 dark:text-white border border-gray-300 dark:border-neutral-700 rounded px-2 py-1"
                              placeholder="Last name"
                              value={editingCustomerValues.last_name}
                              onChange={(e) =>
                                setEditingCustomerValues((prev) => ({
                                  ...prev,
                                  last_name: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveCustomerEdit(g.customer_id)}
                              className="btn-primary flex-1 text-white bg-blue-600 hover:bg-blue-700 rounded px-3 py-2"
                            >
                              Save Customer
                            </button>
                            <button
                              onClick={cancelEditCustomer}
                              className="flex-1 rounded px-3 py-2 border border-gray-300 dark:border-neutral-600 bg-gray-100 text-gray-800 dark:bg-neutral-800 dark:text-gray-100"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-end">
                          <button
                            onClick={() => startEditCustomer(g)}
                            className="text-sm rounded px-3 py-1 border border-gray-300 dark:border-neutral-600 bg-gray-100 text-gray-800 dark:bg-neutral-800 dark:text-gray-100"
                          >
                            Edit Customer Info
                          </button>
                        </div>
                      )}

                      {/* SAMPLES FOR THIS CUSTOMER */}
                      {g.samples.map((s) => (
                        <div
                          key={s.id}
                          className="p-3 rounded border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 space-y-2"
                        >
                          {editingSampleId === s.id ? (
                            <>
                              <input
                                className="input w-full bg-white text-black dark:bg-neutral-900 dark:text-white border border-gray-300 dark:border-neutral-700 rounded px-2 py-1"
                                placeholder="Manufacturer"
                                value={editingSampleValues.manufacturer}
                                onChange={(e) =>
                                  setEditingSampleValues((prev) => ({
                                    ...prev,
                                    manufacturer: e.target.value,
                                  }))
                                }
                              />
                              <input
                                className="input w-full bg-white text-black dark:bg-neutral-900 dark:text-white border border-gray-300 dark:border-neutral-700 rounded px-2 py-1"
                                placeholder="Style Name"
                                value={editingSampleValues.style_name}
                                onChange={(e) =>
                                  setEditingSampleValues((prev) => ({
                                    ...prev,
                                    style_name: e.target.value,
                                  }))
                                }
                              />
                              <input
                                className="input w-full bg-white text-black dark:bg-neutral-900 dark:text-white border border-gray-300 dark:border-neutral-700 rounded px-2 py-1"
                                placeholder="Color Name"
                                value={editingSampleValues.color_name}
                                onChange={(e) =>
                                  setEditingSampleValues((prev) => ({
                                    ...prev,
                                    color_name: e.target.value,
                                  }))
                                }
                              />

                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => saveSampleEdit(s.id)}
                                  className="btn-primary flex-1 text-white bg-blue-600 hover:bg-blue-700 rounded px-3 py-2"
                                >
                                  Save Sample
                                </button>
                                <button
                                  onClick={cancelEditSample}
                                  className="flex-1 rounded px-3 py-2 border border-gray-300 dark:border-neutral-600 bg-gray-100 text-gray-800 dark:bg-neutral-800 dark:text-gray-100"
                                >
                                  Cancel
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <p>
                                <b>Manufacturer:</b> {s.manufacturer}
                              </p>
                              <p>
                                <b>Style:</b> {s.style_name}
                              </p>
                              <p>
                                <b>Color:</b> {s.color_name}
                              </p>
                              <p>
                                <b>Checked Out:</b>{" "}
                                {new Date(
                                  s.checked_out_at || ""
                                ).toLocaleString()}
                              </p>

                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => startEditSample(s)}
                                  className="text-sm rounded px-3 py-2 border border-gray-300 dark:border-neutral-600 bg-gray-100 text-gray-800 dark:bg-neutral-800 dark:text-gray-100"
                                >
                                  Edit Sample
                                </button>
                                <button
                                  onClick={() => checkInOne(s.id)}
                                  className="btn-green flex-1 text-white bg-green-600 hover:bg-green-700 rounded px-3 py-2"
                                >
                                  Check In
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}

                      <button
                        onClick={() =>
                          checkInAll(
                            g.customer_id,
                            g.samples.map((s) => s.id)
                          )
                        }
                        className="btn-primary w-full mt-2 text-white bg-blue-600 hover:bg-blue-700 rounded px-3 py-2"
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
              <p className="text-center text-gray-500">
                No samples are checked out.
              </p>
            ) : (
              filteredSamples.map((s) => (
                <div
                  key={s.id}
                  className="card bg-white text-black dark:bg-neutral-900 dark:text-white border border-gray-200 dark:border-neutral-700 rounded-lg p-4 space-y-2"
                >
                  <p>
                    <b>Customer:</b> {s.customers.first_name}{" "}
                    {s.customers.last_name}
                  </p>
                  <p>
                    <b>Manufacturer:</b> {s.manufacturer}
                  </p>
                  <p>
                    <b>Style:</b> {s.style_name}
                  </p>
                  <p>
                    <b>Color:</b> {s.color_name}
                  </p>

                  <button
                    onClick={() => checkInOne(s.id)}
                    className="btn-green mt-2 w-full text-white bg-green-600 hover:bg-green-700 rounded px-3 py-2"
                  >
                    Check In
                  </button>
                </div>
              ))
            ))}
        </div>
      </main>
    </div>
  );
}
