"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Image from "next/image";
import Link from "next/link";

const associates = [
  "Ed",
  "Shawn",
  "Leroy",
  "Matt",
  "Chris",
  "Amy",
  "Chandra",
  "Josh",
  "Ben "
];

const popularManufacturers = [
  "Karndean",
  "Coretec",
  "Mannington",
  "Perfect Home",
  "Daltile",
  "Robbins",
  "Stanton",
  "IFC",
  "Dixie",
  "Fabrica",
  "Masland",
  "Emser",
  "Happy Feet",
  "Happy Floors",
  "Cali",
];

const quickCategories = [
  "Vinyl Plank",
  "Carpet",
  "Ceramic/Porcelain",
  "Sheet Vinyl",
  "Commercial",
  "Other",
] as const;

type SampleMode = "detailed" | "quick";

type SampleInput = {
  mode: SampleMode;
  manufacturer: string;
  style_name: string;
  color_name: string;
  category: string;
  otherCategory: string;
  quantity: string; // keep as string for the input, convert to number on submit
};

function createEmptySample(): SampleInput {
  return {
    mode: "detailed",
    manufacturer: "",
    style_name: "",
    color_name: "",
    category: "",
    otherCategory: "",
    quantity: "",
  };
}

function formatPhone(input: string): string {
  const cleaned = input.replace(/\D/g, "").slice(0, 10);
  if (cleaned.length < 4) return cleaned;
  if (cleaned.length < 7) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
}

function isSampleFilled(sample: SampleInput): boolean {
  if (sample.mode === "detailed") {
    return Boolean(
      sample.manufacturer.trim() ||
        sample.style_name.trim() ||
        sample.color_name.trim()
    );
  }

  // quick
  return Boolean(
    sample.category.trim() ||
      sample.otherCategory.trim() ||
      sample.quantity.trim()
  );
}

export default function CheckOutPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [associate, setAssociate] = useState("");

  const [samples, setSamples] = useState<SampleInput[]>(
    Array.from({ length: 5 }, () => createEmptySample())
  );

  const [suggestions, setSuggestions] = useState<string[][]>(
    Array.from({ length: 5 }, () => [])
  );

  const handleSampleChange = <K extends keyof SampleInput>(
    index: number,
    field: K,
    value: SampleInput[K]
  ) => {
    setSamples((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });

    if (field === "manufacturer") {
      const text = String(value);
      const filtered =
        text.trim().length === 0
          ? []
          : popularManufacturers.filter((m) =>
              m.toLowerCase().startsWith(text.toLowerCase())
            );

      setSuggestions((prev) => {
        const newSuggestions = [...prev];
        newSuggestions[index] = filtered;
        return newSuggestions;
      });
    }
  };

  const selectSuggestion = (index: number, value: string) => {
    setSamples((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], manufacturer: value };
      return updated;
    });

    setSuggestions((prev) => {
      const newSuggestions = [...prev];
      newSuggestions[index] = [];
      return newSuggestions;
    });
  };

  const setSampleMode = (index: number, mode: SampleMode) => {
    setSamples((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        mode,
        // when switching modes, we do NOT clear anything,
        // so users can switch back and forth without losing data
      };
      return updated;
    });

    // if switching away from detailed, hide suggestions for that row
    if (mode === "quick") {
      setSuggestions((prev) => {
        const newSuggestions = [...prev];
        newSuggestions[index] = [];
        return newSuggestions;
      });
    }
  };

  const addSample = () => {
    setSamples((prev) => [...prev, createEmptySample()]);
    setSuggestions((prev) => [...prev, []]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .insert([{ first_name: firstName, last_name: lastName, phone }])
      .select()
      .single();

    if (custErr) {
      alert(custErr.message);
      return;
    }

    const filled = samples.filter((s) => isSampleFilled(s));

    if (filled.length === 0) {
      alert("Please enter at least one sample.");
      return;
    }

    const rows = filled.map((s) => {
      if (s.mode === "detailed") {
        return {
          customer_id: customer.id,
          entry_type: "detailed",
          manufacturer: s.manufacturer || null,
          style_name: s.style_name || null,
          color_name: s.color_name || null,
          category: null,
          category_other: null,
          quantity: null,
          checked_out_by: associate,
          status: "checked_out",
          checked_out_at: new Date().toISOString(),
        };
      }

      // quick
      const isOther = s.category === "Other";
      const quantityValue =
        s.quantity.trim().length > 0 ? Number(s.quantity) : null;

      return {
        customer_id: customer.id,
        entry_type: "quick",
        manufacturer: null,
        style_name: null,
        color_name: null,
        category: isOther ? "Other" : s.category || null,
        category_other: isOther ? s.otherCategory || null : null,
        quantity: quantityValue,
        checked_out_by: associate,
        status: "checked_out",
        checked_out_at: new Date().toISOString(),
      };
    });

    const { error: sampleErr } = await supabase.from("samples").insert(rows);
    if (sampleErr) {
      alert(sampleErr.message);
      return;
    }

    alert("Samples checked out!");

    setFirstName("");
    setLastName("");
    setPhone("");
    setAssociate("");
    setSamples(Array.from({ length: 5 }, () => createEmptySample()));
    setSuggestions(Array.from({ length: 5 }, () => []));
  };

  return (
    <div className="min-h-screen flex flex-col items-center px-4 pb-16">
      {/* HEADER: logo centered, links underneath */}
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

      {/* MAIN CARD */}
      <main className="w-full flex justify-center">
        <div className="w-full max-w-xl bg-white dark:bg-neutral-900 shadow-lg rounded-xl p-6 space-y-8">
          <h1 className="text-3xl font-bold text-center">Check Out Samples</h1>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* CUSTOMER INFO */}
            <section className="space-y-4">
              <h2 className="text-2xl font-extrabold text-center tracking-wide">
                Customer Info
              </h2>

              <div className="space-y-3">
                <input
                  className="border p-2 rounded w-full bg-white text-black dark:bg-neutral-900 dark:text-white"
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
                <input
                  className="border p-2 rounded w-full bg-white text-black dark:bg-neutral-900 dark:text-white"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
                <input
                  className="border p-2 rounded w-full bg-white text-black dark:bg-neutral-900 dark:text-white"
                  placeholder="Phone Number"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  maxLength={14}
                />
              </div>
            </section>

            {/* SALES ASSOCIATE */}
            <section className="space-y-3">
              <h2 className="text-2xl font-extrabold text-center tracking-wide">
                Sales Associate
              </h2>

              <div className="flex justify-center">
                <select
                  className="border p-2 rounded w-full max-w-xs bg-white text-black dark:bg-neutral-900 dark:text-white"
                  value={associate}
                  onChange={(e) => setAssociate(e.target.value)}
                  required
                >
                  <option value="">Select Associate</option>
                  {associates.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </div>
            </section>

            {/* SAMPLES */}
            <section className="space-y-4">
              <h2 className="text-2xl font-extrabold text-center tracking-wide">
                Samples
              </h2>

              {samples.map((sample, i) => (
                <div
                  key={i}
                  className="border rounded-lg bg-neutral-50 dark:bg-neutral-800 p-4 space-y-3"
                >
                  {/* Header row with mode toggle */}
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold">Sample {i + 1}</p>
                    <div className="flex gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setSampleMode(i, "detailed")}
                        className={`px-2 py-1 rounded border ${
                          sample.mode === "detailed"
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-gray-200 text-gray-800 border-gray-300 dark:bg-neutral-700 dark:text-gray-100 dark:border-neutral-600"
                        }`}
                      >
                        Detailed
                      </button>
                      <button
                        type="button"
                        onClick={() => setSampleMode(i, "quick")}
                        className={`px-2 py-1 rounded border ${
                          sample.mode === "quick"
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-gray-200 text-gray-800 border-gray-300 dark:bg-neutral-700 dark:text-gray-100 dark:border-neutral-600"
                        }`}
                      >
                        Quick
                      </button>
                    </div>
                  </div>

                  {/* Detailed mode fields */}
                  {sample.mode === "detailed" && (
                    <>
                      {/* Manufacturer with suggestions */}
                      <div className="relative">
                        <input
                          className="border p-2 rounded w-full bg-white text-black dark:bg-neutral-900 dark:text-white"
                          placeholder="Manufacturer"
                          value={sample.manufacturer}
                          onChange={(e) =>
                            handleSampleChange(
                              i,
                              "manufacturer",
                              e.target.value
                            )
                          }
                          onBlur={() => {
                            // allow click on suggestion before closing
                            setTimeout(() => {
                              setSuggestions((prev) => {
                                const next = [...prev];
                                next[i] = [];
                                return next;
                              });
                            }, 150);
                          }}
                        />

                        {suggestions[i].length > 0 && (
                          <ul className="absolute left-0 right-0 bg-white text-black border rounded shadow max-h-40 overflow-auto z-20">
                            {suggestions[i].map((option) => (
                              <li
                                key={option}
                                className="p-2 hover:bg-gray-200 cursor-pointer"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => selectSuggestion(i, option)}
                              >
                                {option}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <input
                        className="border p-2 rounded w-full bg-white text-black dark:bg-neutral-900 dark:text-white"
                        placeholder="Style Name"
                        value={sample.style_name}
                        onChange={(e) =>
                          handleSampleChange(i, "style_name", e.target.value)
                        }
                      />

                      <input
                        className="border p-2 rounded w-full bg-white text-black dark:bg-neutral-900 dark:text-white"
                        placeholder="Color Name"
                        value={sample.color_name}
                        onChange={(e) =>
                          handleSampleChange(i, "color_name", e.target.value)
                        }
                      />
                    </>
                  )}

                  {/* Quick mode fields */}
                  {sample.mode === "quick" && (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">
                          Category
                        </label>
                        <select
                          className="border p-2 rounded w-full bg-white text-black dark:bg-neutral-900 dark:text-white"
                          value={sample.category}
                          onChange={(e) =>
                            handleSampleChange(i, "category", e.target.value)
                          }
                        >
                          <option value="">Select category</option>
                          {quickCategories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      {sample.category === "Other" && (
                        <input
                          className="border p-2 rounded w-full bg-white text-black dark:bg-neutral-900 dark:text-white"
                          placeholder="Describe category"
                          value={sample.otherCategory}
                          onChange={(e) =>
                            handleSampleChange(
                              i,
                              "otherCategory",
                              e.target.value
                            )
                          }
                        />
                      )}

                      <div className="space-y-1">
                        <label className="text-sm font-medium">
                          Amount / Count
                        </label>
                        <input
                          type="number"
                          min={1}
                          className="border p-2 rounded w-full bg-white text-black dark:bg-neutral-900 dark:text-white"
                          placeholder="Enter a number"
                          value={sample.quantity}
                          onChange={(e) =>
                            handleSampleChange(i, "quantity", e.target.value)
                          }
                        />
                      </div>
                    </>
                  )}
                </div>
              ))}

              {/* Add Sample button (small) */}
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={addSample}
                  className="mt-1 px-3 py-1 text-sm rounded border border-gray-300 bg-gray-100 text-gray-800 dark:bg-neutral-800 dark:text-gray-100 dark:border-neutral-600"
                >
                  Add Sample
                </button>
              </div>
            </section>

            {/* Submit button */}
            <button
              className="
                bg-blue-600 
                text-white 
                py-4 
                rounded-3xl 
                w-full 
                text-2xl 
                font-bold 
                tracking-wide 
                shadow-md 
                hover:bg-blue-700 
                hover:shadow-lg 
                transition
              "
            >
              Check Out Samples
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
