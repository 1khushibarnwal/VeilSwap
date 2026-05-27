"use client";

const stats = [
  {
    title: "Total Intents",
    value: "12",
  },
  {
    title: "Revealed",
    value: "8",
  },
  {
    title: "Executed",
    value: "3",
  },
  {
    title: "Cancelled",
    value: "1",
  },
];

export default function PortfolioStats() {
  return (
    <div className="grid md:grid-cols-4 gap-6">
      {stats.map((stat, index) => (
        <div
          key={index}
          className="
            rounded-3xl
            bg-white/5
            border border-white/10
            p-6
            hover:border-cyan-400/40
            transition-all
          "
        >
          <p className="text-white/50 text-sm">
            {stat.title}
          </p>

          <h3 className="text-4xl font-black mt-3">
            {stat.value}
          </h3>
        </div>
      ))}
    </div>
  );
}