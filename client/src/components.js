//TODO move every here

import axios from "axios";
import { getHost, getResError } from "./Util";
import { useEffect, useState } from "react";
import AvatarImg from "./AvatarImg";

export function ModCategorySelect(props) {
    const options = [];

    const [response, setResponse] = useState(null);
    useEffect(() => {
        (async () => {
            try {
                setResponse(await axios.get(getHost() + '/api/mod/categories'));
                if (response.status !== 200) {
                    throw new Error(getResError(response));
                }
            } catch (error) {
                console.error(error.toString());
                return (<></>);
            }
        })();
    }, []);

    if (!response) {
        return <select></select>;
    }

    const categoryMap = new Map([
        ['All', undefined]
    ]);

    for (const category of response.data) {
        categoryMap.set(category.name, category.id);
    }

    categoryMap.forEach((v, k) => {
        if (props.v == v)
            options.push(<option v={v} selected>{k}</option>);
        else
            options.push(<option v={v}>{k}</option>);
    });

    return (<select id='category' onChange={props.onSelect ? (e) => {
        props.onSelect(e.target.options[e.target.selectedIndex].getAttribute('v'));
    } : undefined}> {options} </select>);
}

export function TopCategorySelect(props) {
    const options = [];
    const categoryMap = new Map([
        ['All Time', undefined],
        ['Week', 'week']
    ]);

    categoryMap.forEach((v, k) => {
        if (props.v == v)
            options.push(<option v={v} selected>{k}</option>);
        else
            options.push(<option v={v}>{k}</option>);
    });

    return (<select id='category' onChange={props.onSelect ? (e) => {
        props.onSelect(e.target.options[e.target.selectedIndex].getAttribute('v'));
    } : undefined}> {options} </select>);
}

export function TopSortSelect(props) {
    const options = [];
    const categoryMap = new Map([
        ['FP', 'points:desc'],
        ['Accuracy', 'accuracy:desc'],
        ['Score', 'score:desc'],
        ['Misses', 'misses:asc'],
        ['Newest', 'submitted:desc'],
        ['FP (Ascending)', 'points:asc'],
        ['Accuracy (Ascending)', 'accuracy:asc'],
        ['Score (Ascending)', 'score:asc'],
        ['Misses (Descending)', 'misses:desc'],
        ['Oldest', 'submitted:asc'],
    ]);

    categoryMap.forEach((v, k) => {
        if ((props.v ?? props.default) === v)
            options.push(<option v={v} selected>{k}</option>);
        else
            options.push(<option v={v}>{k}</option>);
    });

    return (<select id='category' onChange={props.onSelect ? (e) => {
        props.onSelect(e.target.options[e.target.selectedIndex].getAttribute('v'));
    } : undefined}> {options} </select>);
}

export function VerifiedSelect(props) {
    const options = [];
    const categoryMap = new Map([
        ['Verified', '1'],
        ['Not Verified', '0'],
        ['All', undefined],
    ]);

    categoryMap.forEach((v, k) => {
        if ((props.v ?? props.default) === v)
            options.push(<option v={v} selected>{k}</option>);
        else
            options.push(<option v={v}>{k}</option>);
    });

    return (<select id='category' onChange={props.onSelect ? (e) => {
        props.onSelect(e.target.options[e.target.selectedIndex].getAttribute('v'));
    } : undefined}> {options} </select>);
}

export function ManiaSelect(props) {
    const options = [];
    const categoryMap = new Map([
        ['4k', '4'],
        ['5k', '5'],
        ['6k', '6'],
        ['7k', '7'],
        ['8k', '8'],
        ['9k', '9'],
    ]);

    categoryMap.forEach((v, k) => {
        if ((props.v ?? props.default) === v)
            options.push(<option v={v} selected>{k}</option>);
        else
            options.push(<option v={v}>{k}</option>);
    });

    return (<select id='category' onChange={props.onSelect ? (e) => {
        props.onSelect(e.target.options[e.target.selectedIndex].getAttribute('v'));
    } : undefined}> {options} </select>);
}

export function TopPlayerSortSelect(props) {
    const options = [];
    const categoryMap = new Map([
        ['4k FP', 'points4k'],
        ['5k FP', 'points5k'],
        ['6k FP', 'points6k'],
        ['7k FP', 'points7k'],
        ['8k FP', 'points8k'],
        ['9k FP', 'points9k'],
    ]);

    categoryMap.forEach((v, k) => {
        if ((props.v ?? props.default) === v)
            options.push(<option v={v} selected>{k}</option>);
        else
            options.push(<option v={v}>{k}</option>);
    });

    return (<select id='category' onChange={props.onSelect ? (e) => {
        props.onSelect(e.target.options[e.target.selectedIndex].getAttribute('v'));
    } : undefined}> {options} </select>);
}

export function ModsSortSelect(props) {
    const options = [];
    const categoryMap = new Map([
        ['Newest Submitted', 'submitted:desc'],
        ['Oldest Submitted', 'submitted:asc'],
        ['A-Z', 'title:asc'],
        ['Z-A', 'title:desc'],
        ['Most Liked', 'favoritedCount:desc'],
        ['Least Liked', 'favoritedCount:asc'],
        ['Most Downloaded', 'downloadHits:desc'],
        ['Least Downloaded', 'downloadHits:asc'],
    ]);

    categoryMap.forEach((v, k) => {
        if ((props.v ?? props.default) === v)
            options.push(<option v={v} selected>{k}</option>);
        else
            options.push(<option v={v}>{k}</option>);
    });

    return (<select id='category' onChange={props.onSelect ? (e) => {
        props.onSelect(e.target.options[e.target.selectedIndex].getAttribute('v'));
    } : undefined}> {options} </select>);
}

export function SmallBluds(props) {
    const [more, setMore] = useState(false);

    let children = [];
    let other = [];

    let pick = children;

    let i = 0;
    for (const friend of props.data) {
        if (!more && i > 34) {
            pick = other;
        }
        pick.push(
            <a key={friend} href={"/user/" + encodeURIComponent(friend)}>
                <AvatarImg className={props.imgClass ? props.imgClass : 'FrenAvatar'} title={friend} src={getHost() + "/api/user/avatar/" + encodeURIComponent(friend)}></AvatarImg>
            </a>
        );
        i++;
    }

    if (other.length === 1) {
        children.push(other.shift());
    }

    if (other.length > 1) {
        children.push(
            <a title="More" onClick={() => {
                setMore(true);
            }}>
                <div className='FrenAvatar' style={{
                    background: '#0000004d',
                    display: 'inline-block',
                    borderRadius: '30px',
                    alignContent: 'center',
                    overflow: 'hidden',
                }}>+</div>
            </a>
        );
    }

    return children;
}