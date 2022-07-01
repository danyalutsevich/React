import React from "react";
import { Component } from "react";

class Item extends Component {

    constructor(props) {
        super(props)
        this.state = {
            items: [],
            loading: true,
        }
    }

    componentDidMount() {

        fetch('https://api.navigart.fr/18/artworks?sort=random&buster=30&size=600&from=0')
            .then(res => res.json())
            .then(data => {
                this.setState({
                    items: data,
                    loading: false
                })
            })

    }

    render() {

        const {
            items,
            loading
        } = this.state


        if (loading) {
            return (<div>
                <h3>Loading...</h3>
            </div>)
        }

        return (
            <div>
                <h2>Modern art</h2>
                <div>
                    {
                        items.results.map(item =>
                            item._source.ua.artwork.medias.map(image => {
                                var source = `https://images.navigart.fr/${200}/${image.file_name}`

                                return (<img src={source} />)

                            })
                        )
                    }

                </div>
            </div>
        )

    }
}

export default Item
