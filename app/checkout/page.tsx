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

type SampleInput = {
  manufacturer: string;
  style_name: string;
  color_name: string;
};

function formatPhone(input: string): string {
  const cleaned = input.replace(/\D/g, "").slice(0, 10);
  if (cleaned.length < 4) return cleaned;
  if (cleaned.length < 7) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
}

export default function CheckOutPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [associate, setAssociate] = useState("");

  const [samples, setSamples] = useState<SampleInput[]>(
    Array.from({ length: 5 }, () => ({
      manufacturer: "",
      style_name: "",
      color_name: "",
    }))
  );

  // suggestions[index] = array of manufacturer suggestions for that sample
  const [suggestions, setSuggestions] = useState<string[][]>(
    Array.from({ length: 5 }, () => [])
  );

  const handleSampleChange = <K extends keyof SampleInput>(
    index: number,
    field: K,
    value: SampleInput[K]
  ) => {
    const updated = [...samples];
    updated[index] = { ...updated[index], [field]: value };
    setSamples(updated);

    // Only manage suggestions when editing manufacturer
    if (field === "manufacturer") {
      const text = String(value).trim();
      const newSuggestions = [...suggestions];

      if (!text) {
        // If user cleared the field, hide suggestions
        newSuggestions[index] = [];
      } else {
        const filtered = popularManufacturers.filter((m) =>
          m.toLowerCase().startsWith(text.toLowerCase())
        );
        newSuggestions[index] = filtered;
      }

      setSuggestions(newSuggestions);
    }
  };

  const selectSuggestion = (index: number, value: string) => {
    const updated = [...samples];
    updated[index].manufacturer = value;
    setSamples(updated);

    const newSuggestions = [...suggestions];
    newSuggestions[index] = [];
    setSuggestions(newSuggestions);
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

    const filled = samples.filter(
      (s) => s.manufacturer || s.style_name || s.color_name
    );

    if (filled.length === 0) {
      alert("Please enter at least one sample.");
      return;
    }

    const rows = filled.map((s) => ({
      customer_id: customer.id,
      manufacturer: s.manufacturer,
      style_name: s.style_name,
      color_name: s.color_name,
      checked_out_by: associate,
      status: "checked_out",
      checked_out_at: new Date().toISOString(),
    }));

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
    setSamples(
      Array.from({ length: 5 }, () => ({
        manufacturer: "",
        style_name: "",
        color_name: "",
      }))
    );
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
            <Link href="/checkin" className="hover:underline">
              Check In
            </Link>
            <Link href="/checkout" className="hover:underline">
              Check Out
            </Link>
          </nav>
        </div>
      </header>

      {/* MAIN CARD */}
      <main className="w-full flex justify-center">
        <div className="w-full max-w-xl bg-white dark:bg-neutral-900 shadow-lg rounded-xl p-6 space-y-8">
          <h1 className="text-3xl font-bold text-center">
            Check Out Samples
          </h1>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* CUSTOMER INFO */}
            <section className="space-y-4">
              <h2 className="text-2xl md:text-3xl font-extrabold text-center tracking-wide">
                Customer Info
              </h2>

              <div className="space-y-3">
                <input
                  className="border p-2 rounded w-full"
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
                <input
                  className="border p-2 rounded w-full"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
                <input
                  className="border p-2 rounded w-full"
                  placeholder="Phone Number"
                  value={phone}
                  onChange={(e) => setPhone(formatPhone(e.target.value))}
                  maxLength={14}
                />
              </div>
            </section>

            {/* SALES ASSOCIATE */}
            <section className="space-y-3">
              <h2 className="text-2xl md:text-3xl font-extrabold text-center tracking-wide">
                Sales Associate
              </h2>

              <div className="flex justify-center">
                <select
                  className="border p-2 rounded w-full max-w-xs"
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
              <h2 className="text-2xl md:text-3xl font-extrabold text-center tracking-wide">
                Samples (up to 5)
              </h2>

              {samples.map((sample, i) => (
                <div
                  key={i}
                  className="border rounded-lg bg-neutral-50 dark:bg-neutral-800 p-4 space-y-3"
                >
                  <p className="font-semibold mb-1">Sample {i + 1}</p>

                  {/* Manufacturer with suggestions */}
                  <div className="relative">
                    <input
                      className="border p-2 rounded w-full"
                      placeholder="Manufacturer"
                      value={sample.manufacturer}
                      autoComplete="off"
                      onChange={(e) =>
                        handleSampleChange(i, "manufacturer", e.target.value)
                      }
                      onBlur={() => {
                        // Small delay so a click on a suggestion still works
                        setTimeout(() => {
                          setSuggestions((prev) => {
                            const copy = [...prev];
                            copy[i] = [];
                            return copy;
                          });
                        }, 150);
                      }}
                    />

                    {suggestions[i] && suggestions[i].length > 0 && (
                      <ul className="absolute left-0 right-0 bg-white border rounded shadow max-h-40 overflow-auto z-20">
                        {suggestions[i].map((option) => (
                          <li
                            key={option}
                            className="p-2 hover:bg-gray-200 cursor-pointer"
                            onMouseDown={(e) => {
                              // prevent input blur from firing before click
                              e.preventDefault();
                              selectSuggestion(i, option);
                            }}
                          >
                            {option}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <input
                    className="border p-2 rounded w-full"
                    placeholder="Style Name"
                    value={sample.style_name}
                    onChange={(e) =>
                      handleSampleChange(i, "style_name", e.target.value)
                    }
                  />

                  <input
                    className="border p-2 rounded w-full"
                    placeholder="Color Name"
                    value={sample.color_name}
                    onChange={(e) =>
                      handleSampleChange(i, "color_name", e.target.value)
                    }
                  />
                </div>
              ))}
            </section>

            <button
              type="submit"
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
