"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

// SAME LIST AS CHECKOUT (INCLUDING BEN)
const associates = [
  "Ed",
  "Shawn",
  "Leroy",
  "Matt",
  "Chris",
  "Amy",
  "Chandra",
  "Josh",
  "Ben",
];

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
  checked_in_by?: string | null;
  checked_in_at?: string | null;
  customers: Customer;
};

type Group = {
  customer_id: string;
  first_name: string;
  last_name: string;
  samples: Sample[];
};

type ViewMode = "customer" | "sample" | "associate";

type CheckInDialogState = {
  sampleIds: string[];
} | null;

export default function CheckInPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  const [viewBy, setViewBy] = useState<ViewMode>("customer");
  const [sortBy, setSortBy] =
    useState<"manufacturer" | "style_name" | "color_name">("manufacturer");

  const [samplesList, setSamplesList] = useState<Sample[]>([]);
  const [search, setSearch] = useState("");

  // Associate view
  const [selectedAssociate, setSelectedAssociate] = useState<string>("");

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
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(
    null
  );
  const [editingCustomerValues, setEditingCustomerValues] = useState<{
    first_name: string;
    last_name: string;
  }>({
    first_name: "",
    last_name: "",
  });

  // CHECK-IN DIALOG STATE (DROPDOWN INSTEAD OF PROMPT)
  const [checkInDialog, setCheckInDialog] = useState<CheckInDialogState>(null);
  const [checkInAssociate, setCheckInAssociate] = useState<string>("");

  // FETCH
  const fetchData = useCallback(async () => {
    const { data, error } = await supabase
      .from("samples")
      .select("*, customers(*)")
      .eq("status", "checked_out");

    if (error || !data) return;

    const rows = data as Sample[];

    // Build grouped-by-customer for customer & associate views
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

    const sortedGroups = Object.values(map).sort((a, b) =>
      a.last_name.localeCompare(b.last_name)
    );
    setGroups(sortedGroups);

    // Flat sample list for "By Sample" view
    setSamplesList(
      [...rows].sort((a, b) =>
        (a[sortBy] || "").localeCompare(b[sortBy] || "")
      )
    );
  }, [sortBy]);

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
      [
        s.manufacturer,
        s.style_name,
        s.color_name,
        s.checked_out_by ?? "",
      ]
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
            s.checked_out_by ?? "",
          ]
            .filter(Boolean)
            .some((f) => f!.toLowerCase().includes(q))
        )
      : samplesList;

  // ACTIONS – CHECK IN (OPEN DIALOG)
  const checkInOne = (id: string) => {
    setCheckInDialog({ sampleIds: [id] });
    setCheckInAssociate("");
  };

  const checkInAll = (ids: string[]) => {
    setCheckInDialog({ sampleIds: ids });
    setCheckInAssociate("");
  };

  const cancelCheckInDialog = () => {
    setCheckInDialog(null);
    setCheckInAssociate("");
  };

  const confirmCheckIn = async () => {
    if (!checkInDialog) return;
    if (!checkInAssociate) {
      alert("Please select an associate.");
      return;
    }

    const { error } = await supabase
      .from("samples")
      .update({
        status: "checked_in",
        checked_in_by: checkInAssociate,
        checked_in_at: new Date().toISOString(),
      })
      .in("id", checkInDialog.sampleIds);

    if (error) {
      alert(error.message);
      return;
    }

    setCheckInDialog(null);
    setCheckInAssociate("");
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

  // ASSOCIATE VIEW: groups filtered to selected associate
  const associateGroups =
    viewBy === "associate" && selectedAssociate
      ? filteredGroups
          .map((g) => ({
            ...g,
            samples: g.samples.filter(
              (s) => s.checked_out_by === selectedAssociate
            ),
          }))
          .filter((g) => g.samples.length > 0)
      : [];

  // RENDER
  return (
    <div className="min-h-screen flex flex-col items-center px-4 pb-16">
      {/* HEADER: logo + nav */}
      <header className="w-full border-b border-neutral-300 dark:border-neutral-800 mb-6">
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-3 py-4">
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
        <div className="w-full max-w-xl md:max-w-2xl space-y-6 py-6">
          <h1 className="text-2xl md:text-3xl font-bold text-center">
            Check In Samples
          </h1>

          {/* SEARCH */}
          <input
            className="w-full bg-white text-black dark:bg-neutral-900 dark:text-white border border-gray-300 dark:border-neutral-700 rounded px-3 py-2"
            placeholder="Search customers, samples, or associates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          {/* TOGGLE + SORT / ASSOCIATE SELECT */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap justify-between items-center gap-3">
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

                <button
                  onClick={() => setViewBy("associate")}
                  className={`px-3 py-1 rounded text-sm font-medium border ${
                    viewBy === "associate"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-gray-200 text-gray-800 border-gray-300 dark:bg-neutral-800 dark:text-gray-100 dark:border-neutral-600"
                  }`}
                >
                  By Associate
                </button>
              </div>

              {/* SORT SELECT FOR SAMPLE VIEW */}
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
                  className="w-36 bg-white text-black dark:bg-neutral-900 dark:text-white border border-gray-300 dark:border-neutral-700 rounded px-2 py-1"
                >
                  <option value="manufacturer">Manufacturer</option>
                  <option value="style_name">Style Name</option>
                  <option value="color_name">Color</option>
                </select>
              )}
            </div>

            {/* ASSOCIATE DROPDOWN FOR ASSOCIATE VIEW */}
            {viewBy === "associate" && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Associate:</span>
                <select
                  value={selectedAssociate}
                  onChange={(e) => setSelectedAssociate(e.target.value)}
                  className="flex-1 bg-white text-black dark:bg-neutral-900 dark:text-white border border-gray-300 dark:border-neutral-700 rounded px-2 py-1"
                >
                  <option value="">Select associate</option>
                  {associates.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>
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
                  className="bg-white text-black dark:bg-neutral-900 dark:text-white border border-gray-200 dark:border-neutral-700 rounded-lg p-4 space-y-3"
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
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              className="flex-1 bg-white text-black dark:bg-neutral-900 dark:text-white border border-gray-300 dark:border-neutral-700 rounded px-2 py-1"
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
                              className="flex-1 bg-white text-black dark:bg-neutral-900 dark:text-white border border-gray-300 dark:border-neutral-700 rounded px-2 py-1"
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
                          <div className="flex flex-col sm:flex-row gap-2">
                            <button
                              onClick={() => saveCustomerEdit(g.customer_id)}
                              className="flex-1 text-white bg-blue-600 hover:bg-blue-700 rounded px-3 py-2"
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
                                className="w-full bg-white text-black dark:bg-neutral-900 dark:text-white border border-gray-300 dark:border-neutral-700 rounded px-2 py-1"
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
                                className="w-full bg-white text-black dark:bg-neutral-900 dark:text-white border border-gray-300 dark:border-neutral-700 rounded px-2 py-1"
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
                                className="w-full bg-white text-black dark:bg-neutral-900 dark:text-white border border-gray-300 dark:border-neutral-700 rounded px-2 py-1"
                                placeholder="Color Name"
                                value={editingSampleValues.color_name}
                                onChange={(e) =>
                                  setEditingSampleValues((prev) => ({
                                    ...prev,
                                    color_name: e.target.value,
                                  }))
                                }
                              />

                              <div className="flex flex-col sm:flex-row gap-2 mt-2">
                                <button
                                  onClick={() => saveSampleEdit(s.id)}
                                  className="flex-1 text-white bg-blue-600 hover:bg-blue-700 rounded px-3 py-2"
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
                              <p>
                                <b>Checked Out By:</b>{" "}
                                {s.checked_out_by || "Unknown"}
                              </p>

                              <div className="flex flex-col sm:flex-row gap-2 mt-2">
                                <button
                                  onClick={() => startEditSample(s)}
                                  className="text-sm rounded px-3 py-2 border border-gray-300 dark:border-neutral-600 bg-gray-100 text-gray-800 dark:bg-neutral-800 dark:text-gray-100"
                                >
                                  Edit Sample
                                </button>
                                <button
                                  onClick={() => checkInOne(s.id)}
                                  className="flex-1 text-white bg-green-600 hover:bg-green-700 rounded px-3 py-2"
                                >
                                  Check In
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}

                      <button
                        onClick={() => checkInAll(g.samples.map((s) => s.id))}
                        className="w-full mt-2 text-white bg-blue-600 hover:bg-blue-700 rounded px-3 py-2"
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
                  className="bg-white text-black dark:bg-neutral-900 dark:text-white border border-gray-200 dark:border-neutral-700 rounded-lg p-4 space-y-2"
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
                  <p>
                    <b>Checked Out By:</b> {s.checked_out_by || "Unknown"}
                  </p>

                  <button
                    onClick={() => checkInOne(s.id)}
                    className="mt-2 w-full text-white bg-green-600 hover:bg-green-700 rounded px-3 py-2"
                  >
                    Check In
                  </button>
                </div>
              ))
            ))}

          {/* ASSOCIATE VIEW */}
          {viewBy === "associate" &&
            (selectedAssociate === "" ? (
              <p className="text-center text-gray-500">
                Select an associate above to see their customers.
              </p>
            ) : associateGroups.length === 0 ? (
              <p className="text-center text-gray-500">
                No samples are checked out for {selectedAssociate}.
              </p>
            ) : (
              associateGroups.map((g) => (
                <div
                  key={g.customer_id}
                  className="bg-white text-black dark:bg-neutral-900 dark:text-white border border-gray-200 dark:border-neutral-700 rounded-lg p-4 space-y-3"
                >
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
                      {g.samples.map((s) => (
                        <div
                          key={s.id}
                          className="p-3 rounded border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 space-y-2"
                        >
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
                          <p>
                            <b>Checked Out By:</b>{" "}
                            {s.checked_out_by || "Unknown"}
                          </p>

                          <div className="flex flex-col sm:flex-row gap-2 mt-2">
                            <button
                              onClick={() => startEditSample(s)}
                              className="text-sm rounded px-3 py-2 border border-gray-300 dark:border-neutral-600 bg-gray-100 text-gray-800 dark:bg-neutral-800 dark:text-gray-100"
                            >
                              Edit Sample
                            </button>
                            <button
                              onClick={() => checkInOne(s.id)}
                              className="flex-1 text-white bg-green-600 hover:bg-green-700 rounded px-3 py-2"
                            >
                              Check In
                            </button>
                          </div>
                        </div>
                      ))}

                      <button
                        onClick={() => checkInAll(g.samples.map((s) => s.id))}
                        className="w-full mt-2 text-white bg-blue-600 hover:bg-blue-700 rounded px-3 py-2"
                      >
                        Check In ALL
                      </button>
                    </div>
                  )}
                </div>
              ))
            ))}
        </div>
      </main>

      {/* CHECK-IN DIALOG (ASSOCIATE DROPDOWN) */}
      {checkInDialog && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-sm bg-white dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 rounded-lg p-4 space-y-4">
            <h2 className="text-lg font-semibold">Check In Samples</h2>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Who is checking these samples in?
            </p>
            <select
              value={checkInAssociate}
              onChange={(e) => setCheckInAssociate(e.target.value)}
              className="w-full bg-white text-black dark:bg-neutral-900 dark:text-white border border-gray-300 dark:border-neutral-700 rounded px-2 py-2"
            >
              <option value="">Select associate</option>
              {associates.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                onClick={cancelCheckInDialog}
                className="px-3 py-2 rounded border border-gray-300 dark:border-neutral-600 bg-gray-100 text-gray-800 dark:bg-neutral-800 dark:text-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={confirmCheckIn}
                className="px-3 py-2 rounded bg-green-600 hover:bg-green-700 text-white font-semibold"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
