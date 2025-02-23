import { useEffect, useState } from "react";
import { getHost, headProfileColor, moneyFormatter, ordinalNum, textProfileColor } from "../Util";
import { Icon } from "@iconify/react/dist/iconify.js";
import AvatarImg from "../AvatarImg";

function Leaderboard() {
    const [data, setData] = useState([{
        player: '',
        points: 0,
        profileHue: 0
    }]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tablePage, setTablePage] = useState(0);

    const fetchData = async (page) => {
        try {
            setLoading(true);
            page = page ?? 0;
            const response = await fetch(getHost() + '/api/network/top/players?page=' + page);
            if (!response.ok) {
                throw new Error('Couldn\'t return players.');
            }
            const data = await response.json();
            console.log(data);
            setTablePage(page);
            setError(null);
            setData(data);
            setLoading(false);
        } catch (error) {
            setError(error.message);
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchData();
    }, []);
    
    return (
            <div className='Content'>
                <div className='Contents'> 
                    {loading ? (
                        <p>Loading...</p>
                    ) : error ? (
                        <p>Error: {error}</p>
                    ) : (
                        <>
                            <h1>Top Players by FP</h1>
                            {renderPlayers(data, tablePage)}
                            <br></br>
                            {(tablePage > 0) ?
                                <button className='SvgButton' style={{float: 'left'}} onClick={() => {
                                    fetchData(tablePage - 1);
                                }}> <Icon width={20} icon="mdi:arrow-left" /> </button>
                            : <></>}
                            
                            {(data.length === 15) ?
                            <button className='SvgButton' style={{float: 'right'}} onClick={() => {
                                fetchData(tablePage + 1);
                            }}> <Icon width={20} icon="mdi:arrow-right" /> </button>
                            : <></>}
                        </>
                    )}
                </div>
            </div>
        )
}

function renderPlayers(data, page) {
    let daPlayers = [];
    
    for (const player of data) {
        const daRank = daPlayers.length + 1 + (page * 15);
        daPlayers.push(
            <div className="FlexBox">
                <a href={"/user/" + encodeURIComponent(player.player)} className='TopContainer' style={{ backgroundColor: headProfileColor(player.profileHue ?? 0)}}>
                    <AvatarImg className='TopAvatar' src={getHost() + "/api/avatar/" + btoa(player.player)}></AvatarImg>
                    <div className="FlexBox">
                        <span style={{fontSize: '20px', color: (
                            daRank === 1 ? 'orange' :
                            daRank === 2 ? 'darksalmon' : 
                            daRank === 3 ? 'lightsteelblue' : 
                            'darkgray' 
                        )}}>{ordinalNum(daRank)}</span>
                        <span style={{ fontSize: '35px' }}> {player.player} </span> <br></br>
                        <span style={{fontSize: '20px', color: 'gainsboro'}}> {moneyFormatter.format(player.points)} FP </span>
                    </div>
                </a>
            </div>
        );
    }

    return daPlayers;
}

export default Leaderboard;