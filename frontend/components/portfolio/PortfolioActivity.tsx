"use client";

const activities = [
  {
    type: "Intent Submitted",
    id: "#8",
    status: "Pending",
  },
  {
    type: "Intent Revealed",
    id: "#7",
    status: "Revealed",
  },
  {
    type: "Intent Executed",
    id: "#3",
    status: "Executed",
  },
];

export default function PortfolioActivity() {
  return (
    <div
      className="
        rounded-3xl
        border border-purple-500/20
        bg-white/5
        backdrop-blur-xl
        p-8
      "
    >
      <h2 className="text-3xl font-bold mb-6">
        Recent Activity
      </h2>

      <div className="space-y-4">
        {activities.map((activity, index) => (
          <div
            key={index}
            className="
              glass
              rounded-2xl
              p-5
              flex
              items-center
              justify-between
            "
          >
            <div>
              <p className="font-semibold">
                {activity.type}
              </p>

              <p className="text-white/50 text-sm">
                Intent {activity.id}
              </p>
            </div>

            <div
              className="
                px-4 py-2
                rounded-full
                bg-cyan-400/10
                text-cyan-300
                text-sm
              "
            >
              {activity.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}