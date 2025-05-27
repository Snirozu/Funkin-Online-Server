import axios from 'axios';
import Cookies from 'js-cookie';
import { useEffect, useState } from 'react';
import AvatarImg from './AvatarImg';
import { getHost, hasAccess, headProfileColor } from './Util';

function HeadBar() {
    const [data, setData] = useState({
        name: '',
        points: 0,
        profileHue: 250
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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

            document.documentElement.style.setProperty('--head-profile-color', headProfileColor(data.profileHue));

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

    return (
        <>
            <div className="Bar">
                <a href="/">HOME</a>
                <a href="/network">NETWORK</a>
                <a href="/stats">STATS</a>
                <a href="/search">SEARCH</a>
                <a href="/top">TOP</a>
                {Cookies.get('authid') ? <a href="/friends">FRIENDS</a> : <></>}
                {hasAccess('/admin') ? <a href="/admin" style={{color: 'tomato'}}>ADMIN</a> : <></>}
                {loading ? (
                    <></>
                ) : error ? (
                    <></>
                ) : (
                    <>
                        <a className='BarProfile' href={"/user/" + encodeURIComponent(data.name)}>
                            <AvatarImg className='SmallerAvatar' src={getHost() + "/api/avatar/" + encodeURIComponent(data.name)}/>
                            <div className='BarProfileText'>
                                <b>Welcome, {data.name}! </b> <br></br>
                                Points: {data.points}
                            </div>
                        </a>
                    </>
                )}
            </div>
        </>
    )
}

export default HeadBar;