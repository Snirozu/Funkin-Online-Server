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