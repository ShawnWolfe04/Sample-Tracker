"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function SamplesPage() {
  const [samples, setSamples] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchSamples() {
    // Get all samples
    const { data: samplesData, error } = await supabase
      .from("samples")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    // For each sample, get its latest checkout info
    const samplesWithStatus = await Promise.all(
      samplesData.map(async (sample) => {
        const { data: checkoutData } = await supabase
          .from("checkouts")
          .select("*")
          .eq("sample_id", sample.id)
          .is("returned_at", null) // get active checkout
          .maybeSingle();

        return {
          ...sample,
          checkedOutBy: checkoutData?.checked_out_by ?? null,
          checkedOutAt: checkoutData?.checked_out_at ?? null,
        };
      })
    );

    setSamples(samplesWithStatus);
    setLoading(false);
  }

  // Check out a sample
  async function checkOut(sampleId: string) {
    const name = prompt("Who is checking this out?");
    if (!name) return;

    const { error } = await supabase.from("checkouts").insert([
      {
        sample_id: sampleId,
        checked_out_by: name,
      },
    ]);

    if (error) console.error(error);
    fetchSamples();
  }

  // Return a sample
  async function returnSample(sampleId: string) {
    const { data: checkout } = await supabase
      .from("checkouts")
      .select("*")
      .eq("sample_id", sampleId)
      .is("returned_at", null)
      .single();

    if (!checkout) return;

    const { error } = await supabase
      .from("checkouts")
      .update({ returned_at: new Date().toISOString() })
      .eq("id", checkout.id);

    if (error) console.error(error);
    fetchSamples();
  }

  useEffect(() => {
    fetchSamples();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Samples</h1>

      {loading && <p>Loading...</p>}

      <ul>
        {samples.map((sample) => (
          <li key={sample.id} style={{ marginBottom: 18 }}>
            <b>{sample.name}</b>
            <div style={{ fontSize: 14, opacity: 0.7 }}>
              {sample.description}
            </div>

            {/* Status */}
            {sample.checkedOutBy ? (
              <p style={{ color: "red" }}>
                Checked out by: {sample.checkedOutBy}
              </p>
            ) : (
              <p style={{ color: "green" }}>Available</p>
            )}

            {/* Buttons */}
            {!sample.checkedOutBy ? (
              <button onClick={() => checkOut(sample.id)}>
                Check Out
              </button>
            ) : (
              <button onClick={() => returnSample(sample.id)}>
                Return
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
