import React, { useEffect, useState } from 'react';
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import axios from 'axios';
import dayjs from "dayjs";

const ValueHistoryChart = ({ filter = 'daily' }) => {
  const [data, setData] = useState([]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(
          `${import.meta.env.VITE_API_BASE_URL}/api/user-history`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        console.log("Raw value history data:", res.data);

        if (!Array.isArray(res.data)) {
          console.warn("Expected array but got:", res.data);
          setData([]);
          return;
        }

        const formatted = res.data.map((entry) => ({
          ...entry,
          date: new Date(entry.date), 
          total_value: Number(entry.total_value || entry.avg_value), 
        }));

        console.log("Formatted:", formatted.map(d => ({
          ...d,
          valueType: typeof d.total_value,
          isNaN: isNaN(d.total_value),
        })));
        setData(formatted);
      } catch (err) {
        console.error('Failed to load value history:', err);
      }
    };

    fetchHistory(); 

    // Re-fetch when balance is updated
    const handleUpdate = () => fetchHistory();
    window.addEventListener("balanceUpdated", handleUpdate);

    return () => {
      window.removeEventListener("balanceUpdated", handleUpdate);
    };
  }, [filter]);



  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <h2 className="text-lg font-bold mb-4">Portfolio Value History</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <Line type="monotone" dataKey="total_value" stroke="#8884d8" strokeWidth={2} dot={true} />
          <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
          <XAxis   dataKey="date" tickFormatter={(tick) => dayjs(tick).format("DD/MM/YYYY HH:mm")}minTickGap={20}/>
          <YAxis domain={[0, 'auto']} />
          <Tooltip />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ValueHistoryChart;
