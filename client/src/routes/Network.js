import { useEffect, useState } from "react";
import AvatarImg from "../AvatarImg";
import { getHost } from "../Util";

function Network() {
    const [data, setData] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [sezData, setSezData] = useState([]);
    const [sezLoading, setSezLoading] = useState(true);
    const [sezError, setSezError] = useState(null);

    const fetchData = async () => {
        try {
            const response = await fetch(getHost() + '/api/network/online');
            if (!response.ok) {
                throw new Error('Players not found.');
            }
            const data = await response.json();
            setError(null);
            setData(data);
            setLoading(false);
        } catch (error) {
            setError(error.message);
            setLoading(false);
        }

        try {
            const response = await fetch(getHost() + '/api/network/sezdetal');
            if (!response.ok) {
                throw new Error('Messages not found.');
            }
            const data = await response.json();
            setSezError(null);
            setSezData(data);
            setSezLoading(false);
        } catch (error) {
            setSezError(error.message);
            setSezLoading(false);
        }
    };
    useEffect(() => {
        setSezLoading(true);
        setLoading(true);
        fetchData();
    }, []);

    return (
        <div className="Content">
            <div className="Main">
                <p> Online Players </p>
                <div className="CenterFlex">
                    {loading ? (
                        <p>Loading...</p>
                    ) : error ? (
                        <p>Error: {error}</p>
                    ) : (
                        renderPlayers(data.network)
                    )}
                </div>
                <p> Currently in a Match: {data.playing}</p>
                <p> Available Rooms </p>
                <div className="CenterFlex">
                    {loading ? (
                        <p>Loading...</p>
                    ) : error ? (
                        <p>Error: {error}</p>
                    ) : (
                        renderRooms(data.rooms)
                    )}
                </div>
                <p> Last Global Messages </p>
                <div className="Comments">
                    {sezLoading ? (
                        <p>Loading...</p>
                    ) : sezError ? (
                        <p>Error: {sezError}</p>
                    ) : (
                        renderSezs(sezData)
                    )}
                </div>
            </div>
        </div>
    )
}

function renderSezs(msgs) {
    let render = [];

    for (const msg of msgs) {
        render.push(<div className="Comment" style={{maxWidth: '70%'}}>
            <AvatarImg className="SmallerAvatar" src={getHost() + "/api/avatar/" + btoa(msg.player)}></AvatarImg>
            <div>
                <a href={"/user/" + msg.player}>{msg.player}</a> <br></br>
                <span>{msg.message}</span> <br></br>
            </div>
        </div>);
    }

    if (render.length < 1) {
        render.push(<p>No yappers...</p>);
    }
    
    return render;
}

function renderPlayers(players) {
    let render = [];

    for (const player of players) {
        render.push(
            <div className="Coolbox">
                <a href={"/user/" + encodeURIComponent(player)}>
                    <AvatarImg className='NetworkAvatar' src={getHost() + "/api/avatar/" + btoa(player)}></AvatarImg>
                    <br></br><span>{player}</span>
                </a>
            </div>
        )
    }

    if (render.length < 1) {
        render.push(<p>No players...</p>);
    }

    return render;
}

function renderRooms(rooms) {
    let render = [];

    for (const room of rooms) {
        render.push(
            <div className="Coolbox">
                <span className="BigText">Code: {room.code}</span><br></br>
                <span className="BigText">Player: {room.player}</span><br></br>
                <span className="BigText">Ping: {room.ping}ms</span>
            </div>
        )
    }

    if (render.length < 1) {
        render.push(
            <div>
                <iframe title=":(" src="https://www.youtube.com/embed/v4YHIYXao9I?autoplay=1" width="560" height="315" frameborder="0" allowfullscreen></iframe> <br/>
            </div>
        )
    }

    return render;
}

export default Network;