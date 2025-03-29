import { useEffect, useState } from "react";
import AvatarImg from "../AvatarImg";
import { getHost, miniProfileColor } from "../Util";
import axios from "axios";
import Cookies from 'js-cookie';

function FriendArea() {
    const [data, setData] = useState({
        friends: [],
        pending: [],
        requests: []
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = async () => {
        try {
            const response = await axios.get(getHost() + '/api/account/friends', {
                headers: {
                    'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                }
            });
            if (response.status !== 200) {
                throw new Error('Friends not found.');
            }
            const data = response.data;
            setError(null);
            setData(data);
            setLoading(false);
        } catch (error) {
            setError(error.message);
            setLoading(false);
        }
    };
    useEffect(() => {
        setLoading(true);
        fetchData();
    }, []);

    return <>
        <div className='Content'>
            <div className="Main">
                <p> Friends </p>
                <div className="CenterFlex">
                    {loading ? (
                        <p>Loading...</p>
                    ) : error ? (
                        <p>Error: {error}</p>
                    ) : (
                        renderFriends(data.friends)
                    )}
                </div>
                <p> Pending Invite from </p>
                <div className="CenterFlex">
                    {loading ? (
                        <p>Loading...</p>
                    ) : error ? (
                        <p>Error: {error}</p>
                    ) : (
                        renderPlayers(data.requests)
                    )}
                </div>
                <p> Pending Invite to </p>
                <div className="CenterFlex">
                    {loading ? (
                        <p>Loading...</p>
                    ) : error ? (
                        <p>Error: {error}</p>
                    ) : (
                        renderPlayers(data.pending)
                    )}
                </div>
            </div>
        </div>
    </>;
}

function renderFriends(players) {
    let render = [];

    for (const player of players) {
        render.push(
            <div className="Coolbox" style={{ backgroundColor: miniProfileColor(player.hue ?? 0)}}>
                <a href={"/user/" + encodeURIComponent(player.name)}>
                    <AvatarImg className='NetworkAvatar' src={getHost() + "/api/avatar/" + encodeURIComponent(player.name)}></AvatarImg>
                    <br></br><span>{player.name}</span>
                    <br></br><span style={{color: (player.status === 'ONLINE' ? 'lime' : 'gray')}}>{player.status}</span>
                </a>
            </div>
        )
    }

    return render;
}

function renderPlayers(players) {
    let render = [];

    for (const player of players) {
        render.push(
            <div className="Coolbox">
                <a href={"/user/" + encodeURIComponent(player)}>
                    <AvatarImg className='NetworkAvatar' src={getHost() + "/api/avatar/" + encodeURIComponent(player)}></AvatarImg>
                    <br></br><span>{player}</span>
                </a>
            </div>
        )
    }

    return render;
}

export default FriendArea;