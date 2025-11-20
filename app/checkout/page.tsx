"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import Link from "next/link";

const associates = ["Ed", "Shawn", "Leroy", "Matt", "Chris", "Amy", "Chandra", "Josh"];
const popularManufacturers = [
  "Karndean", "Coretec", "Mannington", "Perfect Home", "Daltile",
  "Robbins", "Stanton", "IFC", "Dixie", "Fabrica", "Masland",
  "Emser", "Happy Feet", "Happy Floors", "Cali"
];

export default function CheckOutPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [samples, setSamples] = useState([
    { manufacturer: "", style_name: "", color_name: "" },
    { manufacturer: "", style_name: "", color_name: "" },
    { manufacturer: "", style_name: "", color_name: "" },
    { manufacturer: "", style_name: "", color_name: "" },
    { manufacturer: "", style_name: "", color_name: "" },
  ]);
  const [associate, setAssociate] = useState("");
  const [suggestions, setSuggestions] = useState<string[][]>(
    Array(5).fill([]) // one array of suggestions for each sample row
  );

  const handleSampleChange = (i: number, field: "manufacturer" | "style_name" | "color_name", value: string) => {
    const updated = [...samples];
    updated[i][field] = value;
    setSamples(updated);

    if (field === "manufacturer") {
      const filtered = popularManufacturers.filter((m) =>
        m.toLowerCase().startsWith(value.toLowerCase())
      );
      const newSuggestions = [...suggestions];
      newSuggestions[i] = filtered;
      setSuggestions(newSuggestions);
    }
  };

  const handleSelectSuggestion = (i: number, value: string) => {
    const updated = [...samples];
    updated[i].manufacturer = value;
    setSamples(updated);

    const newSuggestions = [...suggestions];
    newSuggestions[i] = [];
    setSuggestions(newSuggestions);
  };

  const handleSubmit = async (e: any) => {
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
      checked_out_at: new Date().toISOString()
    }));

    const { error: sampleErr } = await supabase.from("samples").insert(rows);
    if (sampleErr) return alert(sampleErr.message);

    alert("Samples checked out!");
    setFirstName("");
    setLastName("");
    setPhone("");
    setAssociate("");
    setSamples(Array(5).fill({ manufacturer: "", style_name: "", color_name: "" }));
    setSuggestions(Array(5).fill([]));
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Customer Check Out</h1>

      <Link
        href="/checkin"
        className="text-blue-600 underline mb-4 inline-block"
      >
        Go to Check In Page
      </Link>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Customer Info */}
        <div>
          <h2 className="font-bold">Customer Info</h2>
          <input className="border p-2 w-full my-2" placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          <input className="border p-2 w-full my-2" placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          <input className="border p-2 w-full my-2" placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        {/* Associate Dropdown */}
        <div>
          <h2 className="font-bold">Sales Associate</h2>
          <select className="border p-2 w-full" value={associate} onChange={(e) => setAssociate(e.target.value)} required>
            <option value="">Select Associate</option>
            {associates.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>

        {/* Samples */}
        <div>
          <h2 className="font-bold mb-2">Samples (up to 5)</h2>
          {samples.map((s, i) => (
            <div key={i} className="border p-3 rounded mb-2 relative">

              {/* Manufacturer with autocomplete */}
              <input
                className="border p-2 w-full mb-2"
                placeholder="Manufacturer"
                value={s.manufacturer}
                onChange={(e) => handleSampleChange(i, "manufacturer", e.target.value)}
              />
              {suggestions[i] && suggestions[i].length > 0 && (
                <ul className="absolute z-10 bg-white border w-full mt-1 rounded shadow-lg max-h-40 overflow-auto">
                  {suggestions[i].map((option) => (
                    <li
                      key={option}
                      className="p-2 hover:bg-gray-200 cursor-pointer"
                      onClick={() => handleSelectSuggestion(i, option)}
                    >
                      {option}
                    </li>
                  ))}
                </ul>
              )}

              <input
                className="border p-2 w-full mb-2"
                placeholder="Style Name"
                value={s.style_name}
                onChange={(e) => handleSampleChange(i, "style_name", e.target.value)}
              />

              <input
                className="border p-2 w-full"
                placeholder="Color Name"
                value={s.color_name}
                onChange={(e) => handleSampleChange(i, "color_name", e.target.value)}
              />
            </div>
          ))}
        </div>

        <button className="bg-blue-600 text-white p-3 rounded w-full">
          Check Out Samples
        </button>
      </form>
    </div>
  );
}
