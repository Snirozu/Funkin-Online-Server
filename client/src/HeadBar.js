import axios from 'axios';
import Cookies from 'js-cookie';
import { useEffect, useState } from 'react';
import AvatarImg from './AvatarImg';
import { getHost, hasAccess, headProfileColor, tabButtonColor } from './Util';
import { Icon } from '@iconify/react/dist/iconify.js';

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

    return (
        <>
            <div className="Bar" onMouseLeave={() => {
                setTopTab(false);
            }}>
                <a href="/" style={{ display: 'flex', height: '45px', width: '45px' }}><img alt="HOME" src='/images/locon.png'></img></a>
                {
                    !topTab ? <>
                        <a className='TabButton' href="/network">NETWORK</a>
                        <a className='TabButton' href="/stats">STATS</a>
                        <a className='TabButton' href="/search">SEARCH</a>
                        <a className='TabButton' href="##" onClick={() => {
                            setTopTab(true);
                        }}>TOP</a>
                        <a className='TabButton' href="/club">CLUB</a>
                        {Cookies.get('authid') ? <a className='TabButton' href="/friends">FRIENDS</a> : <></>}
                        {hasAccess('/admin') ? <a className='TabButton' href="/admin" style={{ color: 'tomato' }}>ADMIN</a> : <></>}
                    </> : 
                    <>
                        <a className='TabButton' href="/top/players">PLAYERS</a>
                        <a className='TabButton' href="/top/clubs">CLUBS</a>
                    </>
                }
                {loading ? (
                    <></>
                ) : error ? (
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
                            <a className='TabButton' id='BarProfile' href={"/user/" + encodeURIComponent(data.name)}>
                                <AvatarImg className='SmallerAvatar' src={getHost() + "/api/user/avatar/" + encodeURIComponent(data.name)}/>
                                <div className='BarProfileText'>
                                    <b>Welcome, {data.name}! </b> <br></br>
                                    Points: {formatNumber(data.points)}
                                </div>
                            </a>
                        </div>
                    </>
                )}
            </div>
        </>
    )
}

export default HeadBar;