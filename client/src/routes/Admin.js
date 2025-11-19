import Cookies from 'js-cookie';
import { getHost, timeAgo } from '../Util';
import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react/dist/iconify.js';
import axios from 'axios';

function Admin() {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchReports = async () => {
        try {
            const response = await fetch(getHost() + '/api/admin/report/list', {
                headers: {
                    'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                }
            });
            if (!response.ok) {
                throw new Error('Could not load reports.');
            }
            const data = await response.json();
            setError(null);
            setReports(data);
            setLoading(false);
        } catch (error) {
            setError(error.message);
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchReports();
    }, []);

    async function removeReport(id, index) {
        const response = await fetch(getHost() + '/api/admin/report/delete?id=' + id, {
            headers: {
                'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
            }
        });
        if (!response.ok) {
            throw new Error('Could not remove report.\n' + await response.text());
        }
        const reportsCopy = reports.slice();
        delete reportsCopy[index];
        setReports(reportsCopy);
    }

    var reportsBody = [];

    if (reports)
        for (const [i, report] of reports.entries()) {
            if (!report)
                continue;

            const spans = [];
            if ((report.content + '').startsWith('{')) {
                spans.push(<>
                    <a href={'/api/admin/report/content?id=' + report.id }>(JSON DATA: SEE CONTENTS)</a>
                </>);
            }
            else {
                const contents = (report.content + '').split('\n');
                const scoreId = contents[0].split('Score #')[1];
                for (const [i, item] of contents.entries()) {
                    spans.push(<>
                        {item.startsWith('Score #') ? 
                            <ScoreReport id={scoreId}>  </ScoreReport> 
                            : 
                        <>
                            <span style={{ color: 'white' }}>{item}</span> 
                        </>}
                        {i < contents.length - 1 ? <> <br /> <br /> </> : <></> }
                    </>);
                }
                spans.push(<>
                    <br></br>
                    <br></br>
                    <button className="FunkinButton" onClick={async () => {
                        if (!window.confirm('Are you sure?'))
                            return;

                        const response = await axios.get(getHost() + '/api/admin/score/delete?id=' + scoreId, {
                            headers: {
                                'Authorization': 'Basic ' + btoa(Cookies.get('authid') + ":" + Cookies.get('authtoken'))
                            }, validateStatus: () => true
                        });

                        if (response.status === 200) {
                            window.location.reload();
                        }
                        else {
                            alert(response.data);
                        }

                        removeReport(report.id);
                    }}> Delete Score </button>
                </>)
            }

            reportsBody.push(
                <div className="Comment">
                    <img style={{ maxWidth: '60px', maxHeight: '60px' }} src={getHost() + '/api/user/avatar/' + report.by} alt=''></img>
                    <div>
                        <a href={getHost() + '/user/' + report.by}> By: {report.by} <br></br> </a>
                        {spans}
                        <br></br>
                        <span className="SmallText"> {timeAgo.format(Date.parse(report.date))} </span>
                    </div>
                    <div className='FlexRight'>
                        <button title='Remove Report' className='SvgNoButton' style={{ color: 'white' }} 
                            onClick={() => { 
                                if (!window.confirm('Are you sure?'))
                                    return; 

                                removeReport(report.id, i) 
                            }}>
                            <Icon width={40} icon="gridicons:cross" />
                        </button>
                    </div>
                </div>
            );
        }

    return (
        <div className='Content'>
            <div>
                <h2> welcom to teh awsome admin <img height={40} src="images/peael.png" alt=''></img> {Cookies.get('username').toLowerCase()} </h2>
                <h3> Reports: </h3>
                {
                    loading ? <center> Loading... </center> :
                        error ? <center> Error: {error} </center> :
                            reportsBody.length === 0 ? <center> None. </center> :
                                reportsBody
                }
            </div>
        </div>
    );
}

function ScoreReport(props) {
    const [data, setData] = useState({});

    async function fetchData() {
        const response = await fetch(getHost() + '/api/score/replay?id=' + props.id);
        if (!response.ok) {
            throw new Error('Could not fetch replay.\n' + await response.text());
        }
        setData(await response.json());
    }
    useEffect(() => {
        fetchData();
    }, []);

    return <>
        {data ? <>
            <a href={'/user/' + data.player}> {data.player + '\'s'} </a>
            <a href={'/api/score/replay?id=' + props.id}> Score </a>
            on
            <a href={'/song/' + data.songId + '?strum=' + (data.opponent_mode ? 1 : 2)}> {data.song + '-' + data.difficulty} </a>
        </> : <>
            <> fetching </>
        </>}
    </>;
}

export default Admin;