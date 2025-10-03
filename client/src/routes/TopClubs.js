import { useEffect, useState } from "react";
import { allCountries, getHost, headProfileColor, moneyFormatter, ordinalNum } from "../Util";
import { Icon } from "@iconify/react/dist/iconify.js";
import AvatarImg from "../AvatarImg";
import { CountrySelect, Flag } from "./User";
import { useNavigate, useSearchParams } from "react-router-dom";

function TopClubs() {
    const [searchParams] = useSearchParams();
    let page = Number.parseInt(searchParams.get('page') ?? '0');
    const navigate = useNavigate();

    const [data, setData] = useState([{
        name: '',
        tag: '',
        points: 0,
    }]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = async (newPage) => {
        try {
            setLoading(true);
            page = newPage ?? page;
            navigate('/top/clubs?page=' + page);
            const response = await fetch(getHost() + '/api/top/clubs?page=' + page);
            if (!response.ok) {
                throw new Error('Couldn\'t return clubs.');
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
                            <h1 className="davefont">Top Clubs by FP</h1>
                            {renderClubs(data, page)}
                            <br></br>
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

function renderClubs(data, page) {
    let daClubs = [];
    
    for (const club of data) {
        const daRank = daClubs.length + 1 + (page * 15);
        daClubs.push(
            <div className="FlexBox">
                <a href={"/club/" + encodeURIComponent(club.tag)} className='TopContainer' style={{ background: headProfileColor(club.hue)}}>
                    <img alt='' className="TopClubBanner" src={getHost() + "/api/club/banner/" + encodeURIComponent(club.tag)}></img>
                    <div className="FlexBox">
                        <span style={{fontSize: '20px', color: (
                            daRank === 1 ? 'orange' :
                            daRank === 2 ? 'darksalmon' : 
                            daRank === 3 ? 'lightsteelblue' : 
                            'darkgray' 
                        )}}>{ordinalNum(daRank)}</span>
                        <span style={{ fontSize: '35px' }}> {club.name + ' [' + club.tag + ']'} </span> 
                        <br></br>
                        <span style={{fontSize: '20px', color: 'gainsboro'}}> {moneyFormatter.format(club.points)} FP </span>
                    </div>
                </a>
            </div>
        );
    }

    return daClubs;
}

export default TopClubs;