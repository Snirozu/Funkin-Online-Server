import { useEffect, useState } from "react";
import { allCountries, getHost, headProfileColor, moneyFormatter, ordinalNum } from "../Util";
import { Icon } from "@iconify/react/dist/iconify.js";
import AvatarImg from "../AvatarImg";
import { CountrySelect, Flag } from "./User";
import { useNavigate, useSearchParams } from "react-router-dom";

function Leaderboard() {
    const [searchParams] = useSearchParams();
    let page = Number.parseInt(searchParams.get('page') ?? '0');
    let country = searchParams.get('country');
    const navigate = useNavigate();

    const [data, setData] = useState([{
        player: '',
        points: 0,
        profileHue: 0,
        profileHue2: undefined,
        country: ''
    }]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = async (newPage, newCountry) => {
        try {
            setLoading(true);
            page = newPage ?? page;
            country = newCountry ?? country;
            navigate('/top?page=' + page + (country ? '&country=' + country : ''));
            const response = await fetch(getHost() + '/api/top/players?page=' + page + (country ? '&country=' + country : ''));
            if (!response.ok) {
                throw new Error('Couldn\'t return players.');
            }
            const data = await response.json();
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
                            <h1 className="davefont">Top Players by FP{country ? ' from ' + allCountries.get(country) : ''}</h1>
                            {renderPlayers(data, page)}
                            <br></br>
                            <center> Filter by Country: <CountrySelect onSelect={(selCountry) => {
                                if (!allCountries.has(selCountry)) {
                                    country = null;
                                    selCountry = null;
                                }
                                fetchData(0, selCountry);
                            }} country={country}/></center>
                            {(page > 0) ?
                                <button className='SvgButton' style={{float: 'left'}} onClick={() => {
                                    fetchData(page - 1);
                                }}> <Icon width={20} icon="mdi:arrow-left" /> </button>
                            : <></>}
                            
                            {(data.length === 15) ?
                            <button className='SvgButton' style={{float: 'right'}} onClick={() => {
                                fetchData(page + 1);
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
                <a href={"/user/" + encodeURIComponent(player.player)} className='TopContainer' style={{ background: headProfileColor(player.profileHue, player.profileHue2)}}>
                    <AvatarImg className='TopAvatar' src={getHost() + "/api/avatar/" + encodeURIComponent(player.player)}></AvatarImg>
                    <div className="FlexBox">
                        <span style={{fontSize: '20px', color: (
                            daRank === 1 ? 'orange' :
                            daRank === 2 ? 'darksalmon' : 
                            daRank === 3 ? 'lightsteelblue' : 
                            'darkgray' 
                        )}}>{ordinalNum(daRank)}</span>
                        <span style={{ fontSize: '35px' }}> {player.player} </span> 
                        {player.country ?
                            <Flag className='BiggerFlag' code={player.country}></Flag>
                        : <></>}
                        <br></br>
                        <span style={{fontSize: '20px', color: 'gainsboro'}}> {moneyFormatter.format(player.points)} FP </span>
                    </div>
                </a>
            </div>
        );
    }

    return daPlayers;
}

export default Leaderboard;