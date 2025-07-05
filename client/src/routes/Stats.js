import { Chart, registerables } from "chart.js";
import { useEffect, useState } from "react";
import { Doughnut, Line } from "react-chartjs-2";
import { getHost } from "../Util";

function Stats() {
    Chart.register(...registerables);

    return (
        <div className="Content">
            <div className="Main">
                <RenderOnlineChart></RenderOnlineChart>
                <RenderCountryChart></RenderCountryChart>
            </div>
        </div>
    )
}

function RenderOnlineChart() {
    const [dataOnline, setDataOnline] = useState({});
    const [loadingOnline, setLoadingOnline] = useState(true);
    const [errorOnline, setErrorOnline] = useState(null);

    const fetchOnlineStats = async () => {
        try {
            const response = await fetch(getHost() + '/api/stats/day_players');
            if (!response.ok) {
                throw new Error('Could not load online count stats.');
            }
            let counts = [];
            let timestamps = [];

            const data = await response.json();
            data.forEach(element => {
                const date = new Date(element[1]);
                counts.push(element[0]);
                const h = date.getHours();
                const m = date.getMinutes();
                timestamps.push(((h < 10 ? '0' : '') + h) + ":" + ((m < 10 ? '0' : '') + m) + " " + date.getDate() + "/" + (date.getMonth() + 1));
            });

            setErrorOnline(null);
            setDataOnline({
                labels: timestamps,
                datasets: [{
                    label: 'Players',
                    data: counts,
                    fill: false,
                    tension: 0.1
                }]
            });
            setLoadingOnline(false);
        } catch (error) {
            setErrorOnline(error.message);
            setLoadingOnline(false);
        }
    };
    useEffect(() => {
        fetchOnlineStats();
    }, []);

    if (loadingOnline)
        return (<p>Loading...</p>)
    if (errorOnline)
        return (<p>Error: {errorOnline}</p>);

    return (

        <div className="chart-container">
            <h2 style={{ textAlign: "center" }}>Online Players statistics in the last 2~ days</h2>
            <Line
                data={dataOnline}
            />
        </div>
    );
}

function RenderCountryChart() {
    const [dataOnline, setDataOnline] = useState({});
    const [loadingOnline, setLoadingOnline] = useState(true);
    const [errorOnline, setErrorOnline] = useState(null);

    const fetchOnlineStats = async () => {
        try {
            const response = await fetch(getHost() + '/api/stats/country_players');
            if (!response.ok) {
                throw new Error('Could not load online graph.');
            }
            const unsortedData = [];
            const data = await response.json();

            for (var key in data) {
                if (data.hasOwnProperty(key)) {
                    unsortedData.push({
                        label: key,
                        count: data[key]
                    });
                }
            }

            if (unsortedData.length < 1) {
                throw new Error("Couldn't load country stats data.");
            }

            unsortedData.sort((from, to) => from.count - to.count);

            setErrorOnline(null);
            setDataOnline({
                labels: unsortedData.map(e => e.label),
                datasets: [{
                    label: 'Players',
                    data: unsortedData.map(e => e.count),
                    fill: true
                }]
            });
            setLoadingOnline(false);
        } catch (error) {
            setErrorOnline(error.message);
            setLoadingOnline(false);
        }
    };
    useEffect(() => {
        fetchOnlineStats();
    }, []);

    if (loadingOnline)
        return (<p>Loading...</p>)
    if (errorOnline)
        return (<p>Error: {errorOnline}</p>);

    return (
        <div className="chart-container">
            <h2 style={{ textAlign: "center" }}>Unique Players by country</h2>
            <Doughnut
                data={dataOnline}
            />
        </div>
    );
}

export default Stats;