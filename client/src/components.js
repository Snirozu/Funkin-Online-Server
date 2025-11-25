//TODO move every here

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