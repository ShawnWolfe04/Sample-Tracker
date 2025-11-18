"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AddSamplePage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState("");

  async function addSample(e: React.FormEvent) {
    e.preventDefault();

    const { error } = await supabase.from("samples").insert([
      { name, description }
    ]);

    if (error) {
      setMessage("Error: " + error.message);
    } else {
      setMessage("Sample added!");
      setName("");
      setDescription("");
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h1>Add Sample</h1>
      <form onSubmit={addSample} style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 300 }}>
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

        <button type="submit">Add Sample</button>
      </form>

      {message && <p>{message}</p>}
    </div>
  );
}
