"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function CheckOutPage() {
  const router = useRouter();

  const [sampleName, setSampleName] = useState("");
  const [checkedOutBy, setCheckedOutBy] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from("samples").insert([
      {
        name: sampleName,
        status: "checked_out",
        checked_out_by: checkedOutBy,
        checked_out_at: new Date().toISOString(),
      },
    ]);

    setLoading(false);

    if (error) {
      alert(error.message);
    } else {
      alert("Sample checked out!");
      setSampleName("");
      setCheckedOutBy("");

      // Redirect to the check-in page (your "active samples" page)
      router.push("/checkin");
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">Check Out Sample</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Sample Name"
          className="border p-2 w-full"
          value={sampleName}
          onChange={(e) => setSampleName(e.target.value)}
          required
        />

        <input
          type="text"
          placeholder="Checked Out By"
          className="border p-2 w-full"
          value={checkedOutBy}
          onChange={(e) => setCheckedOutBy(e.target.value)}
          required
        />

        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded w-full"
          disabled={loading}
        >
          {loading ? "Checking Out..." : "Check Out Sample"}
        </button>
      </form>
    </div>
  );
}
