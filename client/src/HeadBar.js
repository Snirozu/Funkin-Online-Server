import axios from 'axios';
import Cookies from 'js-cookie';
import { useEffect, useState } from 'react';
import AvatarImg from './AvatarImg';
import { getHost } from './Util';

function HeadBar() {
    const [data, setData] = useState({
        name: '',
        points: 0,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = async () => {
        try {
            const response = await axios.get(getHost() + '/api/network/account/me', {
                headers: {
                    'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                }
            }); // Replace with your API endpoint
            if (response.status !== 200) {
                throw new Error('Not logged in');
            }
            const data = response.data;
            if (data.isMod) {
                Cookies.set('modmode', true, {sameSite: 'none'});
            }
            setData(data);
            setLoading(false);
        } catch (error) {
            setError('Not logged in');
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchData();
    }, []);

    return (
        <>
            <div className="Bar">
                <a href="/">HOME</a>
                <a href="/network">NETWORK</a>
                <a href="/stats">STATS</a>
                {loading ? (
                    <></>
                ) : error ? (
                    <></>
                ) : (
                    <>
                        <a className='BarProfile' id={data.name} href={"/user/" + encodeURIComponent(data.name)}>
                            <AvatarImg className='SmallerAvatar' src={getHost() + "/api/avatar/" + btoa(data.name)}/>
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