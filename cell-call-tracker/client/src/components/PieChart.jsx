import React from 'react'
import { Pie } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend as ChartLegend } from 'chart.js'
ChartJS.register(ArcElement, Tooltip, ChartLegend)

export default function PieChart({ data }){
  const labels = data.map(d=>d.name);
  const values = data.map(d=>d.value || 0);
  const bg = data.map(d=>d.color || '#777');
  const chartData = { labels, datasets: [{ data: values, backgroundColor: bg, borderColor: '#fff', borderWidth: 1 }] };
  const options = {
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const v = ctx.raw ?? 0;
            const total = values.reduce((s,n)=>s+(Number(n)||0),0) || 1;
            const pct = Math.round((v/total)*1000)/10;
            return `${ctx.label}: ${v} (${pct}%)`;
          }
        }
      }
    }
  };
  return (
    <div style={{width:'100%', height:240}}>
      <Pie data={chartData} options={options} />
    </div>
  );
}
