import Cookies from 'js-cookie';
import { getHost, timeAgo } from '../Util';
import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';

function Notifications() {
    const [notifs, setNotifs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchNotifs = async () => {
        try {
            const response = await fetch(getHost() + '/api/account/notifications', {
                headers: {
                    'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                }
            });
            if (!response.ok) {
                throw new Error('Could not load notifications.');
            }
            const data = await response.json();
            setError(null);
            setNotifs(data);
            setLoading(false);
        } catch (error) {
            setError(error.message);
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchNotifs();
    }, []);

    async function removeNotification(id, index) {
        const response = await fetch(getHost() + '/api/account/notifications/delete/' + id, {
            headers: {
                'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
            }
        });
        if (!response.ok) {
            throw new Error('Could not remove notification.\n' + await response.text());
        }
        const notifsCopy = notifs.slice();
        notifsCopy.splice(index, 1);
        setNotifs(notifsCopy);
    }

    var notifsBody = [];

    if (notifs)
        for (const [i, notif] of notifs.entries()) {
            if (!notif)
                continue;
            notifsBody.push(
                <div className="Comment">
                    <img style={{ maxWidth: '60px', maxHeight: '60px' }} src={notif.image} alt=''></img>
                    <div>
                        <a href={notif.href}>{notif.title} <br></br>
                        <span style={{color: 'white'}}>{notif.content}</span>
                        </a>
                        <br></br>
                        <span className="SmallText"> {timeAgo.format(Date.parse(notif.date))} </span>
                    </div>
                    <div className='FlexRight'>
                        <button title='Remove Notification' className='SvgNoButton' style={{ color: 'white' }} 
                            onClick={() => removeNotification(notif.id, i)}>
                            <Icon width={40} icon="gridicons:cross" />
                        </button>
                    </div>
                </div>
            );
        }

    return (
        <div className='Content'>
            <div>
                <h3> Notifications: </h3>
                {
                    loading ? <center> Loading... </center> :
                        error ? <center> Error: {error} </center> :
                            notifsBody.length === 0 ? <center> None. </center> :
                                notifsBody
                }
            </div>
        </div>
    );
}

export default Notifications;