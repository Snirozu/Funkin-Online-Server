import { useEffect, useState } from "react";
import AvatarImg from "../AvatarImg";
import { getHost } from "../Util";
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
            const response = await axios.get(getHost() + '/api/network/account/friends', {
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
                        renderPlayers(data.friends)
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

    }

    return render;
}

export default FriendArea;