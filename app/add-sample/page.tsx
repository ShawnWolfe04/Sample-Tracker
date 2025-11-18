"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function CheckOutSamplePage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [person, setPerson] = useState("");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // 1. Create the sample
    const { data: sample, error: sampleError } = await supabase
      .from("samples")
      .insert([{ name, description }])
      .select()
      .single();

    if (sampleError) {
      setMessage("Error creating sample: " + sampleError.message);
      return;
    }

    // 2. Immediately check it out
    const { error: checkoutError } = await supabase.from("checkouts").insert([
      {
        sample_id: sample.id,
        checked_out_by: person,
      },
    ]);

    if (checkoutError) {
      setMessage("Error checking out: " + checkoutError.message);
      return;
    }

    setMessage(`Sample checked out to ${person}!`);

    // Clear fields
    setName("");
    setDescription("");
    setPerson("");
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Check Out a Sample</h1>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          maxWidth: 300,
        }}
      >
        <input
          type="text"
          placeholder="Sample name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <input
          type="text"
          placeholder="Checked out by (name)"
          value={person}
          onChange={(e) => setPerson(e.target.value)}
          required
        />

        <button type="submit">Add & Check Out</button>
      </form>

      {message && <p>{message}</p>}
    </div>
  );
}
