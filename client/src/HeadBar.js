import axios from 'axios';
import Cookies from 'js-cookie';
import { useEffect, useState } from 'react';
import AvatarImg from './AvatarImg';
import { getHost, hasAccess, headProfileColor, tabButtonColor } from './Util';
import { Icon } from '@iconify/react/dist/iconify.js';
import { localData } from './LocalData';

function formatNumber(num) {
  if (num >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(1).replace(/\.0$/, "") + "B";
  } else if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  } else {
    return num.toString();
  }
}

function HeadBar() {
    const [data, setData] = useState({
        name: '',
        points: 0,
        profileHue: 250,
        profileHue2: undefined,
        notifs: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [topTab, setTopTab] = useState(false);

    function checkCompact() {
        //element.scrollHeight > element.offsetHeight
        return window.innerWidth < 1300;
    }
    function checkMobile() {
        //element.scrollHeight > element.offsetHeight
        return window.innerWidth < 1800;
    }
    const [isMobile, setMobile] = useState(checkMobile());
    const [isCompact, setCompact] = useState(checkCompact());
    const [isMenuOpen, setMenuOpen] = useState(false);

    window.addEventListener("resize", () => {
        setMobile(checkMobile());
        setCompact(checkCompact());
    });

    const fetchData = async () => {
        try {
            const response = await axios.get(getHost() + '/api/account/me', {
                headers: {
                    'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                }
            }); // Replace with your API endpoint
            if (response.status !== 200) {
                throw new Error('Not logged in');
            }
            const data = response.data;
            Cookies.set('username', data.name, { sameSite: 'strict' });
            Cookies.set('access_list', data.access.join(','), { sameSite: 'strict' });

            document.documentElement.style.setProperty('--head-profile-color', headProfileColor(data.profileHue, data.profileHue2));
            document.documentElement.style.setProperty('--head-profile-static-color', headProfileColor(data.profileHue, data.profileHue2, true));
            document.documentElement.style.setProperty('--tab-button-color', tabButtonColor(data.profileHue));

            setError(null);
            setData(data);
            setLoading(false);
        } catch (error) {
            setError('Not logged in');
            setLoading(false);
        }
    };
    useEffect(() => {
        setLoading(true);
        fetchData();
    }, []);

    // if (loading) {
    //     return (<>
    //         <div className="Bar"> </div>
    //     </>);
    // }

    let tabButtonTextClassName = isMobile ? 'HiddenChild' : '';

    const iconsEnabled = !isMenuOpen && isMobile ? true : localData.getBool('upbar_icons', true);

    let menuItems = (
        <>
            {
            !topTab ? <>
                <a className='TabButton' href="/network"> {iconsEnabled ? <img src="/images/network.png"></img> : <></>} <span className={tabButtonTextClassName}>NETWORK</span> </a>
                <a className='TabButton' href="/stats">{iconsEnabled ? <img src="/images/stats.png"></img> : <></>} <span className={tabButtonTextClassName}>STATS</span></a>
                <a className='TabButton' href="/rules">{iconsEnabled ? <img src="/images/info.png"></img> : <></>} <span className={tabButtonTextClassName}>RULES</span></a>
                <a className='TabButton' href="/search">{iconsEnabled ? <img src="/images/search.png"></img> : <></>} <span className={tabButtonTextClassName}>SEARCH</span></a>
                <a className='TabButton' href="/mods">{iconsEnabled ? <img src="/images/mods.png"></img> : <></>} <span className={tabButtonTextClassName}>MODS</span></a>
                <a className='TabButton' href="##" onClick={() => {
                    setTopTab(true);
                }}>{iconsEnabled ? <img src="/images/top.png"></img> : <></>} <span className={tabButtonTextClassName}>TOP</span></a>
                <a className='TabButton' href="/club">{iconsEnabled ? <img src="/images/club.png"></img> : <></>} <span className={tabButtonTextClassName}>CLUB</span></a>
                {Cookies.get('authid') ? <a className='TabButton' href="/friends">{iconsEnabled ? <img src="/images/friends.png"></img> : <></>} <span className={tabButtonTextClassName}>FRIENDS</span></a> : <></>}
                {hasAccess('/admin') ? <a className='TabButton' href="/admin" style={{ color: 'tomato' }}>ADMIN</a> : <></>}
            </> : 
            <>
                <a className='TabButton' href="/top/players">PLAYERS</a>
                <a className='TabButton' href="/top/clubs">CLUBS</a>
            </>
            }
        </>
    )

    return (
        <>
            {isMenuOpen && isMobile ? <> 
                <div onClick={() => {
                    setMenuOpen(false);
                }} style={{
                    backgroundColor: '#0000002d',
                    position: 'fixed',
                    top: '0px',
                    width: '100%',
                    height: '100%',
                    zIndex: '150',
                }}>
                </div> 
                <div style={{top: '60px'}} id="TopBarMenu">
                    {menuItems}
                </div> 
            </> : <></>}
            <div id="bar" className="Bar" onMouseLeave={() => {
                setTopTab(false);
            }}>
                <div className='BarContent'>
                    <a className='BarLogo' href="/"><img style={{height: '45px', width: '45px' }} alt="" src='/images/locon.png'></img></a>
                    {
                        !isCompact ? (
                            <div className="BarMenuItems">
                                 {menuItems}
                            </div> 
                        ) : <>
                            <a className='TabButton' onClick={() => setMenuOpen(true)}> ☰ MENU </a>
                        </>
                    }
                    {error ? (
                        <>
                            <a className='TabButton' href="/login" style={{
                                marginLeft: 'auto',
                                marginRight: '10px'
                            }}>LOGIN</a>
                        </>
                    ) : (
                        <>
                            <div className='FlexRight'>
                                {window.location.pathname !== '/notifications' && data.notifs > 0 ? <>
                                    <a id="NotificationsIcon" className='TabButton' href="/notifications"><Icon icon="ic:baseline-notifications-active" width="32" height="32" /></a>
                                </> : <></>}
                                <a className='TabButton' id='BarProfile' href={"/user/" + encodeURIComponent(loading ? Cookies.get('username') : data.name)}>
                                    <AvatarImg className='SmallerAvatar' src={getHost() + "/api/user/avatar/" + encodeURIComponent(loading ? Cookies.get('username') : data.name)}/>
                                    <div className='BarProfileText'>
                                        <b>Welcome, {loading ? Cookies.get('username') : data.name}! </b> <br></br>
                                        Points: {loading ? '???' : formatNumber(data.points)}
                                    </div>
                                </a>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    )
}

export default HeadBar;