import { useEffect, useState } from "react";
import { allCountries, getHost, headProfileColor, moneyFormatter, ordinalNum, timeAgo } from "../Util";
import { Icon } from "@iconify/react/dist/iconify.js";
import AvatarImg from "../AvatarImg";
import { CountrySelect, Flag } from "./User";
import { useSearchParams } from "react-router-dom";
import { TopCategorySelect } from "../components";
import moment from "moment";

function TopPlayers() {
    const [searchParams, setSearchParams] = useSearchParams();

    const [data, setData] = useState([{
        player: '',
        points: 0,
        profileHue: 0,
        profileHue2: undefined,
        country: '',
        club: undefined
    }]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [weekReset, setWeekReset] = useState(0);

    const page = Number.parseInt(searchParams.get('page') ?? '0');
    const country = searchParams.get('country');
    const category = searchParams.get('category');
    const sort = searchParams.get('sort') ?? 'points4k';

    const fetchData = async () => {
        try {
            setLoading(true);
            const response = await fetch(getHost() + '/api/top/players?page=' + page + (country ? '&country=' + country : '') + (category ? '&category=' + category : '') + ('&sort=' + sort));
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

    const fetchWeekReset = async () => {
        const response = await fetch(getHost() + '/api/nextweekreset');
        if (!response.ok) {
            throw new Error('Couldn\'t get week reset time.');
        }
        setWeekReset(Number.parseInt(await response.text()));
    };

    useEffect(() => {
        fetchData();
        fetchWeekReset();
    }, [searchParams]);

    function Countdown(props) {
        const [activeTime, setActiveTime] = useState(0);

        function formatFromNow(time = 0, format = 'in %d %h %m %s') {
            const timeDiff = time - Date.now();

            format = format.replaceAll('%s', (() => {
                const unit = Math.floor(timeDiff / 1000 % 60);
                if (Math.floor(timeDiff / 1000) <= 0)
                    return 'a moment';
                return unit + ' second' + (unit === 1 ? '' : 's');
            })());

            format = format.replaceAll('%m', (() => {
                const unit = Math.floor(timeDiff / 60000 % 60);
                if (unit <= 0)
                    return '';
                return unit + ' minute' + (unit === 1 ? '' : 's');
            })());

            format = format.replaceAll('%h', (() => {
                const unit = Math.floor(timeDiff / 3600000 % 24);
                if (unit <= 0)
                    return '';
                return unit + ' hour' + (unit === 1 ? '' : 's');
            })());

            format = format.replaceAll('%d', (() => {
                const unit = Math.floor(timeDiff / 86400000);
                if (unit <= 0)
                    return '';
                return unit + ' day' + (unit === 1 ? '' : 's');
            })());

            return format;
        }

        setInterval(() => {
            setActiveTime(activeTime + 1)
        }, 1000)

        let prefix = '';
        switch (activeTime % 4) {
            case 0: {
                prefix = '🕛'
                break;
            }
            case 1: {
                prefix = '🕒'
                break;
            }
            case 2: {
                prefix = '🕕'
                break;
            }
            case 3: {
                prefix = '🕘'
                break;
            }
            default:
        }

        return (<> <b style={{ fontSize: '25px' }}> {prefix} </b> {props.suffix} {formatFromNow(props.time)} </>);
    }

    function renderPlayers(data, page) {
        let daPlayers = [];
        
        for (const player of data) {
            const daRank = daPlayers.length + 1 + (page * 15);
            daPlayers.push(
                <div className="FlexBox">
                    <a href={"/user/" + encodeURIComponent(player.player)} className='TopContainer' style={{ background: headProfileColor(player.profileHue, player.profileHue2)}}>
                        <AvatarImg className='TopAvatar' src={getHost() + "/api/user/avatar/" + encodeURIComponent(player.player)}></AvatarImg>
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
                            <span style={{fontSize: '20px', color: 'gainsboro'}}> {moneyFormatter.format(player[sort])} FP </span>
                        </div>
                        <div style={{ marginLeft: 'auto' }}>
                            <img className='BiggerClubBanner' src={getHost() + '/api/club/banner/' + player.club} alt={player.club ?? ''} /> 
                        </div>
                    </a>
                </div>
            );
        }

        return daPlayers;
    }
    
    return (
            <div className='Content'>
                <div className='Contents'> 
                    {loading ? (
                        <p>Loading...</p>
                    ) : error ? (
                        <p>Error: {error}</p>
                    ) : (
                        <>
                            <h1 className="davefont">Top Players by FP
                            {country ? ' from ' + allCountries.get(country) : ''}
                            {category === 'week' ? ' this week' : ''}
                            </h1>
                            {category === 'week' && weekReset ? <>
                                <center> <Countdown suffix="Next reset" time={weekReset}></Countdown> </center> <br></br>
                            </> : ''}
                            {renderPlayers(data, page)}
                            <br></br>
                            <center>
                            Time: <TopCategorySelect v={searchParams.get('category')} onSelect={(sel) => {
                                searchParams.set('category', sel);
                                if (!sel)
                                    searchParams.delete('category');
                                setSearchParams(searchParams);
                            }} />
                            &nbsp;
                            Country: <CountrySelect onSelect={(selCountry) => {
                                if (!allCountries.has(selCountry)) {
                                    selCountry = null;
                                }
                                searchParams.set('country', selCountry);
                                if (!selCountry)
                                    searchParams.delete('country');
                                setSearchParams(searchParams);
                            }} country={country}/></center>
                            {(page > 0) ?
                                <button className='SvgButton' style={{float: 'left'}} onClick={() => {
                                    searchParams.set('page', page - 1);
                                    setSearchParams(searchParams);
                                }}> <Icon width={20} icon="mdi:arrow-left" /> </button>
                            : <></>}
                            {(data.length === 15) ?
                            <button className='SvgButton' style={{float: 'right'}} onClick={() => {
                                searchParams.set('page', page + 1);
                                setSearchParams(searchParams);
                            }}> <Icon width={20} icon="mdi:arrow-right" /> </button>
                            : <></>}
                        </>
                    )}
                </div>
            </div>
        )
}

export default TopPlayers;