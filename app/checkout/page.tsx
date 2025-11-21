"use client";

import { useState } from "react";
import type { FormEvent, ChangeEvent } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

const associates = ["Ed", "Shawn", "Leroy", "Matt", "Chris", "Amy", "Chandra", "Josh"];

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

export default function CheckOutPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  const [samples, setSamples] = useState<SampleInput[]>(
    Array.from({ length: 5 }, () => ({
      manufacturer: "",
      style_name: "",
      color_name: "",
    }))
  );

  const [associate, setAssociate] = useState("");

  const [suggestions, setSuggestions] = useState<string[][]>(
    Array.from({ length: 5 }, () => [])
  );

  // --------------- Phone Auto-format (555-555-5555) ---------------
  const handlePhoneChange = (e: ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
    let formatted = digits;

    if (digits.length > 6) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    } else if (digits.length > 3) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }

    setPhone(formatted);
  };

  // --------------- Sample Input Handler ---------------
  const handleSampleChange = (
    index: number,
    field: "manufacturer" | "style_name" | "color_name",
    value: string
  ) => {
    const updated = [...samples];
    updated[index][field] = value;
    setSamples(updated);

    if (field === "manufacturer") {
      const filtered = popularManufacturers.filter((m) =>
        m.toLowerCase().startsWith(value.toLowerCase())
      );

      const newList = [...suggestions];
      newList[index] = filtered;
      setSuggestions(newList);
    }
  };

  const handleSelectSuggestion = (index: number, value: string) => {
    const updated = [...samples];
    updated[index].manufacturer = value;
    setSamples(updated);

    const newList = [...suggestions];
    newList[index] = [];
    setSuggestions(newList);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const { data: customer, error: custErr } = await supabase
      .from("customers")
      .insert([{ first_name: firstName, last_name: lastName, phone }])
      .select()
      .single();

    if (custErr) return alert(custErr.message);
    const customerId = customer.id;

    const filtered = samples.filter(
      (s) => s.manufacturer || s.style_name || s.color_name
    );
    if (filtered.length === 0) return alert("Please enter at least one sample.");

    const rows = filtered.map((s) => ({
      customer_id: customerId,
      manufacturer: s.manufacturer,
      style_name: s.style_name,
      color_name: s.color_name,
      checked_out_by: associate,
      status: "checked_out",
      checked_out_at: new Date().toISOString(),
    }));

    const { error: sampleErr } = await supabase.from("samples").insert(rows);
    if (sampleErr) return alert(sampleErr.message);

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
    <div className="min-h-screen flex justify-center">
      <div className="w-full max-w-2xl p-4 space-y-6">
        <h1 className="text-3xl font-bold text-center">Customer Check Out</h1>

        <div className="text-center">
          <Link href="/checkin" className="text-blue-600 underline">
            Go to Check In Page
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Customer Info */}
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <h2 className="font-bold mb-3 text-lg">Customer Info</h2>

            <input className="border p-2 w-full mb-2 rounded" placeholder="First Name"
              value={firstName} onChange={(e) => setFirstName(e.target.value)} />

            <input className="border p-2 w-full mb-2 rounded" placeholder="Last Name"
              value={lastName} onChange={(e) => setLastName(e.target.value)} />

            <input className="border p-2 w-full mb-2 rounded" placeholder="Phone Number"
              value={phone} onChange={handlePhoneChange} />
          </div>

          {/* Associate */}
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <h2 className="font-bold mb-3 text-lg">Sales Associate</h2>

            <select
              className="border p-2 w-full rounded bg-white"
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

          {/* Samples */}
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <h2 className="font-bold mb-3 text-lg">Samples (up to 5)</h2>

            {samples.map((sample, index) => (
              <div key={index} className="border rounded p-3 mb-4 bg-gray-50 relative shadow-sm">

                {/* Manufacturer autocomplete */}
                <input
                  className="border p-2 w-full mb-2 rounded bg-white"
                  placeholder="Manufacturer"
                  value={sample.manufacturer}
                  onChange={(e) =>
                    handleSampleChange(index, "manufacturer", e.target.value)
                  }
                />

                {suggestions[index]?.length > 0 && (
                  <ul className="absolute left-0 right-0 top-20 bg-white text-black border rounded shadow-lg z-20 max-h-40 overflow-auto">
                    {suggestions[index].map((option) => (
                      <li
                        key={option}
                        className="p-2 hover:bg-gray-100 cursor-pointer"
                        onClick={() => handleSelectSuggestion(index, option)}
                      >
                        {option}
                      </li>
                    ))}
                  </ul>
                )}

                <input
                  className="border p-2 w-full mb-2 rounded bg-white"
                  placeholder="Style Name"
                  value={sample.style_name}
                  onChange={(e) =>
                    handleSampleChange(index, "style_name", e.target.value)
                  }
                />

                <input
                  className="border p-2 w-full rounded bg-white"
                  placeholder="Color Name"
                  value={sample.color_name}
                  onChange={(e) =>
                    handleSampleChange(index, "color_name", e.target.value)
                  }
                />
              </div>
            ))}
          </div>

          <button className="bg-blue-600 text-white p-3 rounded w-full text-lg font-semibold shadow">
            Check Out Samples
          </button>
        </form>
      </div>
    </div>
  );
}
